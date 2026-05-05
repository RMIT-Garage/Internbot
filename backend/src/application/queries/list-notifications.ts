import type { RequestActor } from '../actor'
import type { NotificationListResultWithCursor } from '../models/notification'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { NotificationListCursor } from '../../domain/repositories/notification-repository'
import { ForbiddenError } from '../../domain/errors'

export interface ListNotificationsQuery {
  actor: RequestActor
  filter: {
    unreadOnly: boolean
    limit: number
    cursor: NotificationListCursor | undefined
  }
}

export class ListNotificationsQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: ListNotificationsQuery): Promise<NotificationListResultWithCursor> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const page = await ctx.notifications.list({
        userId: platformUser.id,
        unreadOnly: q.filter.unreadOnly,
        limit: q.filter.limit,
        cursor: q.filter.cursor,
      })
      const unreadCount = await ctx.notifications.countUnreadByUserId(platformUser.id)
      return {
        items: page.items,
        nextPageToken: null,
        unreadCount,
        cursor: page.nextCursor,
      }
    })
  }
}
