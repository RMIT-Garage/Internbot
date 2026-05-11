import type { RequestActor } from '../actor'
import type { NotificationResult } from '../models/notification'
import type { UnitOfWork } from '../ports/unit-of-work'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

export interface GetNotificationQuery {
  actor: RequestActor
  notificationId: string
}

export class GetNotificationQueryHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(q: GetNotificationQuery): Promise<NotificationResult> {
    const platformUser = q.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const notification = await ctx.notifications.findById(q.notificationId)
      if (!notification) throw new NotFoundError('Notification', q.notificationId)
      if (notification.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Users may only read their own notifications',
          'notification_not_owner'
        )
      }
      return { notification }
    })
  }
}
