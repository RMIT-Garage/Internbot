import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

export interface MarkNotificationReadCommand {
  actor: RequestActor
  notificationId: string
}

export interface MarkNotificationReadResult {
  id: string
}

export class MarkNotificationReadCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: MarkNotificationReadCommand): Promise<MarkNotificationReadResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const notification = await ctx.notifications.findById(cmd.notificationId)
      if (!notification) throw new NotFoundError('Notification', cmd.notificationId)
      if (notification.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Users may only update their own notifications',
          'notification_not_owner'
        )
      }

      if (notification.readAt === undefined) {
        notification.markRead(new Date())
        await ctx.notifications.save(notification)
      }

      return { id: cmd.notificationId }
    })
  }
}
