import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import { NotFoundError, MethodNotAllowedError, PreconditionFailedError } from '../../domain/errors'
import { AcademicInfo } from '../../domain/value-objects/academic-info'

/**
 * PATCH /api/v1/users/:id command — updates the top-level `displayName`
 * and/or the embedded `studentProfile`.
 *
 * Per WORKFLOW-API-SPEC.md §7.2:
 *   - Student-only. Coordinators → 405 with `Allow: GET`
 *   - `displayName` is student-settable (registration captures no name)
 *   - studentNumber is immutable after first sync (same value = no-op; different = 400)
 *   - profileStatus is derived server-side (never trusted from client)
 *   - `academicInfo.confirmedAt` is set exactly once on the first write
 *     that transitions profileStatus from incomplete to complete
 *
 * Domain logic is delegated to the `User` aggregate's mutation methods;
 * the handler only translates patch keys to method calls and saves. Strict
 * CQRS: returns `{ id }` only; the route runs a follow-up `GetUserQueryHandler`
 * for the response body.
 */
export interface AcademicInfoPatch {
  programName: string
  programLevel: 'undergraduate' | 'postgraduate'
  unitsAttempted: number
  creditUnitsEarned: number
  gpa: number
  currentStudyLoad: 'full_time' | 'part_time' | 'unknown'
  programStatus?: 'active_in_program' | 'completed' | 'discontinued'
  majors?: readonly string[]
  minors?: readonly string[]
  completedCourses?: readonly string[]
  notes?: string
}

export interface UpdateUserProfileCommand {
  actor: RequestActor
  userId: string
  patch: {
    displayName?: string
    studentNumber?: string
    programCode?: string
    phone?: string | null
    academicInfo?: AcademicInfoPatch | null
  }
  metadata?: CommandMetadata
}

export interface UpdateUserProfileResult {
  id: string
}

export class UpdateUserProfileCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: UpdateUserProfileCommand): Promise<UpdateUserProfileResult> {
    const platformUser = this.authz.requirePlatformUser(cmd.actor)
    // Method-resolution (not authz): coordinators have no PATCH on /users/:id,
    // so we surface 405 with `Allow: GET` instead of a 403. Kept inline because
    // the AuthorizationService primitives only model authz denials (403), not
    // HTTP method gating.
    if (platformUser.role === 'coordinator') {
      throw new MethodNotAllowedError(
        'GET',
        'Coordinators have no writable user fields in v1',
        'role_restricted_action'
      )
    }
    this.authz.requireSelfOrRole(cmd.actor, cmd.userId, [], 'student_not_owner')

    return this.uow.execute(async (uow) => {
      const user = await uow.users.findById(cmd.userId)
      if (!user) throw new NotFoundError('User', cmd.userId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== user.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      if (cmd.patch.displayName !== undefined) {
        user.changeDisplayName(cmd.patch.displayName)
      }
      if (cmd.patch.studentNumber !== undefined) {
        user.ensureStudentNumberMatches(cmd.patch.studentNumber)
      }
      if (cmd.patch.programCode !== undefined) {
        user.changeProgramCode(cmd.patch.programCode)
      }
      if (cmd.patch.phone !== undefined) {
        if (cmd.patch.phone === null) user.clearPhone()
        else user.changePhone(cmd.patch.phone)
      }
      if (cmd.patch.academicInfo !== undefined) {
        if (cmd.patch.academicInfo === null) {
          user.clearAcademicInfo()
        } else {
          // `confirmedAt` is owned by the aggregate (stamped on the first
          // transition to `profileStatus: complete`). The patch never
          // supplies it — pass `undefined` and let `setAcademicInfo`
          // preserve any existing stamp across rewrites.
          const a = cmd.patch.academicInfo
          user.setAcademicInfo(
            AcademicInfo.create({
              programName: a.programName,
              programLevel: a.programLevel,
              unitsAttempted: a.unitsAttempted,
              creditUnitsEarned: a.creditUnitsEarned,
              gpa: a.gpa,
              currentStudyLoad: a.currentStudyLoad,
              programStatus: a.programStatus,
              majors: a.majors,
              minors: a.minors,
              completedCourses: a.completedCourses,
              notes: a.notes,
              confirmedAt: undefined,
            })
          )
        }
      }

      await uow.users.save(user)
      return { id: cmd.userId }
    })
  }
}
