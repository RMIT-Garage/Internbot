import type { RequestActor } from '../actor'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { User } from '../../domain/entities/user'
import { NotFoundError } from '../../domain/errors'

export interface UserResult {
  user: User
}

/**
 * GET /api/v1/users/:id query — returns the platform user record.
 *
 * Authorization per WORKFLOW-API-SPEC.md §7.2:
 *   - Students may read only their own record
 *   - Coordinators may read any user
 */
export interface GetUserQuery {
  actor: RequestActor
  userId: string
}

export class GetUserQueryHandler {
  constructor(
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetUserQuery): Promise<UserResult> {
    this.authz.requireSelfOrRole(q.actor, q.userId, 'coordinator', 'student_not_owner')

    const user = await this.userQueries.findById(q.userId)
    if (!user) throw new NotFoundError('User', q.userId)
    return { user }
  }
}
