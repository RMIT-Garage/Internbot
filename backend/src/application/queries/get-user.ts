import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { UserResult } from '../models/user'
import { NotFoundError, ForbiddenError } from '../../domain/errors'

/**
 * GET /api/v1/users/:id query — returns the platform user record.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.2:
 *   - Students may read only their own record (`student_not_owner` otherwise)
 *   - Coordinators may read any user
 *
 * Authz check is inline — no shared `application/authz/` module. Each handler
 * is self-contained.
 */
export interface GetUserQuery {
  actor: RequestActor
  userId: string
}

export class GetUserQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetUserQuery): Promise<UserResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    if (platformUser.role === 'student' && platformUser.id !== q.userId) {
      throw new ForbiddenError('Students may only read their own record', 'student_not_owner')
    }

    return this.uow.execute(async (ctx) => {
      const user = await ctx.users.findById(q.userId)
      if (!user) throw new NotFoundError('User', q.userId)
      return { user }
    })
  }
}
