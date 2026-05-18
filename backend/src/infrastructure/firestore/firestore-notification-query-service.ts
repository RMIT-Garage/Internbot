import { Timestamp, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { Notification } from '../../domain/entities/notification'
import type { NotificationQueryService } from '../../application/ports/queries/notification-query-service'
import type {
  NotificationListCursor,
  NotificationListFilter,
  NotificationListPage,
} from '../../application/read-models/notification'
import { NOTIFICATION_COLLECTION, parseNotification } from './firestore-notification-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Firestore impl of the read-side `NotificationQueryService`. Singleton —
 * not bound to a Firestore Transaction, so list / count traffic does not
 * pay the per-read transactional overhead.
 */
export class FirestoreNotificationQueryService implements NotificationQueryService {
  async findById(id: string): Promise<Notification | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(NOTIFICATION_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseNotification(snap.id, snap.data())
      },
      { op: 'notifications.findById', resource: 'Notification', id }
    )
  }

  async list(filter: NotificationListFilter): Promise<NotificationListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb
          .collection(NOTIFICATION_COLLECTION)
          .where('userId', '==', filter.userId)
        if (filter.unreadOnly) q = q.where('readAt', '==', null)

        q = q.orderBy('createdAt', 'desc').orderBy('__name__', 'desc')

        if (filter.cursor) {
          q = q.startAfter(FsTimestamp.fromDate(filter.cursor.lastValue), filter.cursor.lastDocId)
        }

        q = q.limit(filter.limit + 1)
        const result = await q.get()
        const hasMore = result.size > filter.limit
        const docs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
        const items = docs.map((doc) => parseNotification(doc.id, doc.data()))

        let nextCursor: NotificationListCursor | null = null
        if (hasMore) {
          const last = docs[docs.length - 1]!
          nextCursor = {
            sortField: 'createdAt',
            sortDirection: 'desc',
            lastValue: timestampField(last, 'createdAt').toDate(),
            lastDocId: last.id,
          }
        }

        return { items, nextCursor }
      },
      { op: 'notifications.list', resource: 'Notification' }
    )
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection(NOTIFICATION_COLLECTION)
          .where('userId', '==', userId)
          .where('readAt', '==', null)
          .count()
          .get()
        return snap.data().count
      },
      { op: 'notifications.countUnreadByUserId', resource: 'Notification' }
    )
  }
}

function timestampField(doc: QueryDocumentSnapshot, field: string): Timestamp {
  const value = doc.data()[field]
  if (!(value instanceof Timestamp)) {
    throw new Error(`${doc.ref.path}.${field} is not a Firestore Timestamp`)
  }
  return value
}

/** Production singleton. */
export const firestoreNotificationQueryService: NotificationQueryService =
  new FirestoreNotificationQueryService()
