import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { UserWorkflowResult } from '../models/user-workflow'
import { ForbiddenError, NotFoundError } from '../../domain/errors'
import { deriveWorkflowState } from '../../domain/services/workflow-derivation'

/**
 * GET /api/v1/users/:id/workflow query — returns the derived workflow
 * state triple per WORKFLOW-API-SPEC.md §7.2.
 *
 * Authorization:
 *   - Student owner (`{id} == caller.id`): allowed
 *   - Coordinator: may read any student's workflow during review
 *   - Other students: 403 `student_not_owner`
 *
 * Coordinator targets → 404. The sub-resource doesn't exist for
 * `role: coordinator`. We raise the 404 after the lookup so the absent
 * record path and the wrong-role path produce the same observable
 * status — a coordinator caller can't enumerate which platform users
 * are coordinators by status code.
 */
export interface GetUserWorkflowQuery {
  actor: RequestActor
  userId: string
}

export class GetUserWorkflowQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetUserWorkflowQuery): Promise<UserWorkflowResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError(
        'Caller has no platform user record. Call POST /api/v1/auth/sync first.',
        'no_platform_user'
      )
    }
    if (platformUser.role === 'student' && platformUser.id !== q.userId) {
      throw new ForbiddenError('Students may only read their own workflow', 'student_not_owner')
    }

    return this.uow.execute(async (ctx) => {
      const user = await ctx.users.findById(q.userId)
      if (!user) throw new NotFoundError('User', q.userId)
      if (!user.isStudent()) {
        // Coordinator target — sub-resource does not exist (§7.2).
        throw new NotFoundError('User', q.userId)
      }

      // Load the referenced semester only when one was selected — the
      // window-state derivation needs it. A `semesterId` pointing at a
      // missing semester degrades to `not_enrolled` rather than 500;
      // keeping reads tolerant of dangling references avoids cascading
      // failures during semester archival.
      const semester = user.studentProfile.semesterId
        ? ((await ctx.semesters.findById(user.studentProfile.semesterId)) ?? undefined)
        : undefined

      const workflow = deriveWorkflowState(user, semester, new Date())
      return { workflow }
    })
  }
}
