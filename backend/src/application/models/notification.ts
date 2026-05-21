import type { Notification } from '../../domain/entities/notification'
import type { NotificationRepository } from '../../domain/repositories/notification-repository'

export interface NotificationListResult {
  readonly items: readonly Notification[]
  readonly nextPageToken: string | null
  readonly unreadCount: number
}

export interface NotificationListResultWithCursor extends NotificationListResult {
  readonly cursor: NotificationRepository | null
}

export interface NotificationResult {
  readonly notification: Notification
}
