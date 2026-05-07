import type { RequestActor } from '../actor'
import type { NotificationQueryService } from '../ports/queries/notification-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Notification } from '../../domain/entities/notification'
import type { NotificationListCursor } from '../read-models/notification'

export interface NotificationListResult {
  readonly items: readonly Notification[]
  readonly nextPageToken: string | null
  readonly unreadCount: number
}

export interface NotificationListResultWithCursor extends NotificationListResult {
  readonly cursor: NotificationListCursor | null
}

export interface ListNotificationsQuery {
  actor: RequestActor
  filter: {
    unreadOnly: boolean
    limit: number
    cursor: NotificationListCursor | undefined
  }
}

export class ListNotificationsQueryHandler {
  constructor(
    private readonly notificationQueries: NotificationQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: ListNotificationsQuery): Promise<NotificationListResultWithCursor> {
    const platformUser = this.authz.requirePlatformUser(q.actor)

    const page = await this.notificationQueries.list({
      userId: platformUser.id,
      unreadOnly: q.filter.unreadOnly,
      limit: q.filter.limit,
      cursor: q.filter.cursor,
    })
    const unreadCount = await this.notificationQueries.countUnreadByUserId(platformUser.id)
    return {
      items: page.items,
      nextPageToken: null,
      unreadCount,
      cursor: page.nextCursor,
    }
  }
}
