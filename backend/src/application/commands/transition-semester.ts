import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import type { AuthorizationService } from '../ports/authorization-service'
import type { IdGenerator } from '../ports/id-generator'
import type { SemesterTransitionTarget } from '../../domain/value-objects/semester-enums'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'
import { Notification } from '../../domain/entities/notification'
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
 *
 * When a semester leaves `enrollment_open`, enrolled students receive an
 * in-app notification so they know new applications are closed.
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
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
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

      const fromStatus = semester.status
      const now = new Date()

      semester.applyTransition(cmd.to, platformUser.id, cmd.comment, now)
      await ctx.semesters.save(semester)

      if (shouldNotifyEnrolledStudents(fromStatus, cmd.to)) {
        const studentIds = await ctx.users.listStudentIdsBySemesterId(cmd.semesterId)
        for (const userId of studentIds) {
          await ctx.notifications.save(
            Notification.forSemesterPhaseChange({
              id: this.idGenerator.next(),
              userId,
              semesterDisplayName: semester.displayName,
              toStatus: cmd.to,
              now,
            })
          )
        }
      }

      return { id: cmd.semesterId }
    })
  }
}

function shouldNotifyEnrolledStudents(from: SemesterStatus, to: SemesterTransitionTarget): boolean {
  if (from === 'enrollment_open' && to === 'placement_running') return true
  if (to === 'archived') return true
  return false
}
