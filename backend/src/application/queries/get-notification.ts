import type { RequestActor } from '../actor'
import type { NotificationQueryService } from '../ports/queries/notification-query-service'
import type { AuthorizationService } from '../ports/authorization-service'
import type { Notification } from '../../domain/entities/notification'
import { NotFoundError } from '../../domain/errors'

export interface NotificationResult {
  readonly notification: Notification
}

export interface GetNotificationQuery {
  actor: RequestActor
  notificationId: string
}

export class GetNotificationQueryHandler {
  constructor(
    private readonly notificationQueries: NotificationQueryService,
    private readonly authz: AuthorizationService
  ) {}

  async handle(q: GetNotificationQuery): Promise<NotificationResult> {
    this.authz.requirePlatformUser(q.actor)

    const notification = await this.notificationQueries.findById(q.notificationId)
    if (!notification) throw new NotFoundError('Notification', q.notificationId)
    this.authz.requireSelfOrRole(q.actor, notification.userId, [], 'notification_not_owner')
    return { notification }
  }
}
