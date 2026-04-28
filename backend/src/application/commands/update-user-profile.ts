import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import {
  NotFoundError,
  ForbiddenError,
  MethodNotAllowedError,
  PreconditionFailedError,
} from '../../domain/errors'
import { AcademicInfo } from '../../domain/value-objects/academic-info'

/**
 * PATCH /api/v1/users/:id command — updates the embedded `studentProfile`.
 *
 * Per WORKFLOW-API-SPEC.md §7.2:
 *   - Student-only. Coordinators → 405 with `Allow: GET`
 *   - studentNumber is immutable after first sync (same value = no-op; different = 400)
 *   - profileStatus is derived server-side (never trusted from client)
 *   - `academicInfo.confirmedAt` is set exactly once on the first write
 *     that transitions profileStatus from incomplete to complete
 *
 * Authz is inline — each handler owns its rules. Domain logic is delegated
 * to the `User` aggregate's mutation methods; the handler only translates
 * patch keys to method calls and saves. Strict CQRS: returns `{ id }` only;
 * the route runs a follow-up `GetUserQueryHandler` for the response body.
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
  notes?: string
}

export interface UpdateUserProfileCommand {
  actor: RequestActor
  userId: string
  patch: {
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
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: UpdateUserProfileCommand): Promise<UpdateUserProfileResult> {
    // Authz (transport-concern, stays in handler):
    //   - caller must be synced (has platformUser)
    //   - coordinators have no writable fields here → 405
    //   - students may only edit their own record
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError(
        'Caller has no platform user record. Call POST /api/v1/auth/sync first.',
        'no_platform_user'
      )
    }
    if (platformUser.role === 'coordinator') {
      throw new MethodNotAllowedError(
        'GET',
        'Coordinators have no writable user fields in v1',
        'role_restricted_action'
      )
    }
    if (platformUser.id !== cmd.userId) {
      throw new ForbiddenError('Students may only update their own record', 'student_not_owner')
    }

    return this.uow.execute(async (uow) => {
      const user = await uow.users.findById(cmd.userId)
      if (!user) throw new NotFoundError('User', cmd.userId)

      // Optimistic concurrency: the client's If-Match token (parsed into
      // `metadata.expectedVersion` at the api boundary) is checked against
      // the loaded aggregate's version. The repository's `save()` will
      // double-check atomically at write time, but we throw early here to
      // produce a clean 412 without mutating the aggregate on stale input.
      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== user.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      // Domain mutations — delegated to the aggregate. Each method
      // enforces its own invariants (e.g. student-only, studentNumber
      // immutability) and reconciles derived state (profileStatus,
      // onboardingStage, confirmedAt stamping).
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
