import type { RequestActor } from '../actor'
import type { CommandMetadata } from '../command-metadata'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import { ConflictError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

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
 *       2. referenced semester exists and has `status: enrollment_open`
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
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: SelectSemesterCommand): Promise<SelectSemesterResult> {
    this.authz.requireRole(cmd.actor, 'student')
    this.authz.requireSelfOrRole(cmd.actor, cmd.userId, [], 'student_not_owner')

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

      if (semester.status !== 'enrollment_open') {
        throw new ConflictError(
          `Cannot select semester with status '${semester.status}'`,
          'semester_not_active'
        )
      }
      const now = new Date()

      user.selectSemester(cmd.payload.semesterId, now)

      await uow.users.save(user)
      return { id: cmd.userId }
    })
  }
}
