import type { Notification } from '../../../domain/entities/notification'
import type { NotificationListFilter, NotificationListPage } from '../../read-models/notification'

/**
 * Read-side port for the `notifications` aggregate. Standalone singleton —
 * not on the UnitOfWork. Input/output models live in
 * `application/read-models/notification`.
 *
 * `listUnreadByUserId` lives on the write-side `NotificationRepository`
 * (the bulk mark-all-read command needs it inside the same txn), not here.
 */
export interface NotificationQueryService {
  findById(id: string): Promise<Notification | null>
  list(filter: NotificationListFilter): Promise<NotificationListPage>
  countUnreadByUserId(userId: string): Promise<number>
}
