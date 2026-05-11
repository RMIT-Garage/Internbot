import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type {
  UserActivityFeedCursor,
  UserActivityFeedResultWithCursor,
} from '../models/user-activity'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

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
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: ListUserActivityQuery): Promise<UserActivityFeedResultWithCursor> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.id !== q.userId) {
      throw new ForbiddenError('Users may only read their own activity feed', 'user_not_owner')
    }

    return this.uow.execute(async (ctx) => {
      const user = await ctx.users.findById(q.userId)
      if (!user) throw new NotFoundError('User', q.userId)

      const page = await ctx.activityFeed.listByAuthor({
        authorUserId: q.userId,
        limit: q.filter.limit,
        sortDirection: q.filter.sortDirection,
        cursor: q.filter.cursor,
      })
      return { items: page.items, nextPageToken: null, cursor: page.nextCursor }
    })
  }
}
