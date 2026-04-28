import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { CommandMetadata } from '../command-metadata'
import { ForbiddenError, NotFoundError, PreconditionFailedError } from '../../domain/errors'

/**
 * PATCH /api/v1/semesters/:id command — updates display label and
 * enrolment window only.
 *
 * Per WORKFLOW-API-SPEC.md §7.5:
 *   - Coordinator-only.
 *   - Immutable fields (`id`, `semesterCode`, `courseCode`, `status`)
 *     rejected at the api boundary with 400 (immutable_field) — never reach
 *     this handler. Status transitions go through `TransitionSemesterCommand`.
 *
 * `enrolmentOpenAt` / `enrolmentCloseAt` accept `null` to clear.
 *
 * Strict CQRS: returns `{ id }` only.
 */
export interface UpdateSemesterCommand {
  actor: RequestActor
  semesterId: string
  patch: {
    displayName?: string
    enrolmentOpenAt?: Date | null
    enrolmentCloseAt?: Date | null
  }
  metadata?: CommandMetadata
}

export interface UpdateSemesterResult {
  id: string
}

export class UpdateSemesterCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: UpdateSemesterCommand): Promise<UpdateSemesterResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError(
        'Caller has no platform user record. Call POST /api/v1/auth/sync first.',
        'no_platform_user'
      )
    }
    if (platformUser.role !== 'coordinator') {
      throw new ForbiddenError('Only coordinators may update semesters', 'role_restricted_action')
    }

    return this.uow.execute(async (ctx) => {
      const semester = await ctx.semesters.findById(cmd.semesterId)
      if (!semester) throw new NotFoundError('Semester', cmd.semesterId)

      const expected = cmd.metadata?.expectedVersion
      if (expected !== undefined && expected !== semester.version) {
        throw new PreconditionFailedError('Resource version does not match')
      }

      if (cmd.patch.displayName !== undefined) {
        semester.changeDisplayName(cmd.patch.displayName)
      }
      if (cmd.patch.enrolmentOpenAt !== undefined) {
        semester.changeEnrolmentOpenAt(cmd.patch.enrolmentOpenAt ?? undefined)
      }
      if (cmd.patch.enrolmentCloseAt !== undefined) {
        semester.changeEnrolmentCloseAt(cmd.patch.enrolmentCloseAt ?? undefined)
      }

      await ctx.semesters.save(semester)
      return { id: cmd.semesterId }
    })
  }
}
