import type { Notification } from '../entities/notification'

export interface NotificationRepository {
  create(notification: Notification): Promise<void>
  save(notification: Notification): Promise<void>
}
