import type { RequestActor } from '../actor'
import type { ActivityFeedQueryService } from '../ports/queries/activity-feed-query-service'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { UserActivityFeedCursor, UserActivityFeedItem } from '../read-models/user-activity'
import { NotFoundError } from '../../domain/errors'

export interface UserActivityFeedResult {
  readonly items: readonly UserActivityFeedItem[]
  readonly nextPageToken: string | null
}

export interface UserActivityFeedResultWithCursor extends UserActivityFeedResult {
  readonly cursor: UserActivityFeedCursor | null
}

export interface ListUserActivityQuery {
  actor: RequestActor
  userId: string
  filter: {
    limit: number
    sortDirection: 'asc' | 'desc'
    cursor: UserActivityFeedCursor | undefined
  }
}

export class ListUserActivityQueryHandler {
  constructor(
    private readonly activityFeedQueries: ActivityFeedQueryService,
    private readonly userQueries: UserQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListUserActivityQuery): Promise<UserActivityFeedResultWithCursor> {
    this.authz.requireSelfOrRole(q.actor, q.userId, [], 'user_not_owner')

    const user = await this.userQueries.findById(q.userId)
    if (!user) throw new NotFoundError('User', q.userId)

    const page = await this.activityFeedQueries.listByAuthor({
      authorUserId: q.userId,
      limit: q.filter.limit,
      sortDirection: q.filter.sortDirection,
      cursor: q.filter.cursor,
    })
    return { items: page.items, nextPageToken: null, cursor: page.nextCursor }
  }
}
