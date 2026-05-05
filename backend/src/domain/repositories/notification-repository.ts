import type { Notification } from '../entities/notification'

export interface NotificationListCursor {
  readonly sortField: 'createdAt'
  readonly sortDirection: 'desc'
  readonly lastValue: Date
  readonly lastDocId: string
}

export interface NotificationListFilter {
  readonly userId: string
  readonly unreadOnly: boolean
  readonly limit: number
  readonly cursor: NotificationListCursor | undefined
}

export interface NotificationListPage {
  readonly items: readonly Notification[]
  readonly nextCursor: NotificationListCursor | null
}

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>
  list(filter: NotificationListFilter): Promise<NotificationListPage>
  countUnreadByUserId(userId: string): Promise<number>
  create(notification: Notification): Promise<void>
  save(notification: Notification): Promise<void>
  markUnreadAsReadByUserId(userId: string, now: Date): Promise<number>
}
