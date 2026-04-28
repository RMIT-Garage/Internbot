import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  PreconditionFailedError,
} from '../../domain/errors'

/**
 * PUT /api/v1/users/:id/semester-selection command.
 *
 * Per WORKFLOW-API-SPEC.md §7.6:
 *   - Student-only and **owner-only** (`{id} == caller.id`).
 *   - Coordinator targets → 404 (sub-resource does not exist for
 *     coordinators). The 404 is raised after we load the target user, so
 *     a coordinator can't probe student ids by status code.
 *   - Validates a 3-step chain inside the transaction:
 *       1. target user exists, has role `student`, profile is `complete`
 *       2. referenced semester exists and is `active`
 *       3. enrolment window is open at `now`
 *   - `studentProfile.semesterSelectedAt` is set on the **first** successful
 *     selection; subsequent re-selections preserve the original timestamp
 *     (invariant owned by `StudentProfile.withSemester`).
 *
 * Strict CQRS: returns `{ id }` only — the route runs `GetUserQueryHandler`
 * for the response body so the wire shape matches `GET /users/:id`.
 */
export interface SelectSemesterCommand {
  actor: RequestActor
  userId: string
  payload: {
    semesterId: string
  }
  metadata?: CommandMetadata
}

export interface SelectSemesterResult {
  id: string
}

export class SelectSemesterCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: SelectSemesterCommand): Promise<SelectSemesterResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError(
        'Caller has no platform user record. Call POST /api/v1/auth/sync first.',
        'no_platform_user'
      )
    }
    if (platformUser.role !== 'student') {
      // Coordinators have no semester-selection sub-resource. The spec
      // says 404 when *the target* is a coordinator (handled below); a
      // coordinator caller hitting this on someone else is a separate
      // class of error. 403 with `role_restricted_action` matches the
      // pattern used by other student-only writes (see
      // `update-user-profile`).
      throw new ForbiddenError('Only students may select a semester', 'role_restricted_action')
    }
    if (platformUser.id !== cmd.userId) {
      throw new ForbiddenError('Students may only select their own semester', 'student_not_owner')
    }

    return this.uow.execute(async (uow) => {
      const user = await uow.users.findById(cmd.userId)
      if (!user) throw new NotFoundError('User', cmd.userId)
      if (!user.isStudent()) {
        // Coordinator targets — sub-resource doesn't exist (§7.6).
        throw new NotFoundError('User', cmd.userId)
      }

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== user.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      const semester = await uow.semesters.findById(cmd.payload.semesterId)
      if (!semester) throw new NotFoundError('Semester', cmd.payload.semesterId)

      if (semester.status !== 'active') {
        throw new ConflictError(
          `Cannot select semester with status '${semester.status}'`,
          'semester_not_active'
        )
      }
      const now = new Date()
      if (!semester.isEnrolmentOpen(now)) {
        throw new ConflictError('Semester enrolment window is closed', 'enrolment_window_closed')
      }

      // Domain mutation — also rejects an incomplete profile with
      // `ConflictError(reason: profile_incomplete)`. Mutation is a no-op
      // on the embedded studentProfile if the same semester was already
      // selected (still bumps version through `save` for caller
      // observability).
      user.selectSemester(cmd.payload.semesterId, now)

      await uow.users.save(user)
      return { id: cmd.userId }
    })
  }
}
