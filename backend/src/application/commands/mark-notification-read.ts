import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'
import { NotFoundError } from '../../domain/errors'

export interface MarkNotificationReadCommand {
  actor: RequestActor
  notificationId: string
}

export interface MarkNotificationReadResult {
  id: string
}

export class MarkNotificationReadCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: MarkNotificationReadCommand): Promise<MarkNotificationReadResult> {
    return this.uow.execute(async (ctx) => {
      const notification = await ctx.notifications.findById(cmd.notificationId)
      if (!notification) throw new NotFoundError('Notification', cmd.notificationId)
      this.authz.requireSelfOrRole(cmd.actor, notification.userId, [], 'notification_not_owner')

      if (notification.readAt === undefined) {
        notification.markRead(new Date())
        await ctx.notifications.save(notification)
      }

      return { id: cmd.notificationId }
    })
  }
}
