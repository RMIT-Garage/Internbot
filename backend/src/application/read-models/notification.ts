import type { Notification } from '../../domain/entities/notification'

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

export interface NotificationListResult {
  readonly items: readonly Notification[]
  readonly nextPageToken: string | null
  readonly unreadCount: number
}

export interface NotificationListResultWithCursor extends NotificationListResult {
  readonly cursor: NotificationListCursor | null
}

export interface NotificationResult {
  readonly notification: Notification
}
