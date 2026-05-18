import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import type { SemesterTransitionTarget } from '../../domain/value-objects/semester-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'

/**
 * POST /api/v1/semesters/:id/transitions command — advance a semester
 * through its lifecycle (`draft → active`, `draft → archived`,
 * `active → archived`).
 *
 * Per WORKFLOW-API-SPEC.md §7.5:
 *   - Coordinator-only.
 *   - State-machine validation lives on the aggregate
 *     (`Semester.applyTransition` throws `ConflictError(invalid_state_transition)`).
 *   - Optimistic concurrency via `metadata.expectedVersion` (parsed from
 *     `If-Match` at the api boundary); the repository re-checks the
 *     `version` inside the transaction.
 */
export interface TransitionSemesterCommand {
  actor: RequestActor
  semesterId: string
  to: SemesterTransitionTarget
  comment: string | undefined
  metadata?: CommandMetadata
}

export interface TransitionSemesterResult {
  id: string
}

export class TransitionSemesterCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: TransitionSemesterCommand): Promise<TransitionSemesterResult> {
    const platformUser = this.authz.requireRole(cmd.actor, 'coordinator')

    return this.uow.execute(async (ctx) => {
      const semester = await ctx.semesters.findById(cmd.semesterId)
      if (!semester) throw new NotFoundError('Semester', cmd.semesterId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== semester.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      semester.applyTransition(cmd.to, platformUser.id, cmd.comment, new Date())
      await ctx.semesters.save(semester)
      return { id: cmd.semesterId }
    })
  }
}
