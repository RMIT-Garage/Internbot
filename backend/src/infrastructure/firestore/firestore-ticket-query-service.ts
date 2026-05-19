import { Timestamp, type Query, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { Ticket } from '../../domain/entities/ticket'
import type { TicketQueryService } from '../../application/ports/queries/ticket-query-service'
import type {
  TicketListCursor,
  TicketListFilter,
  TicketListPage,
} from '../../application/read-models/ticket'
import { TICKET_COLLECTION, parseTicket } from './firestore-ticket-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Firestore impl of the read-side `TicketQueryService`. Singleton — not
 * bound to a Firestore Transaction, so list traffic does not pay the
 * per-read transactional overhead.
 */
export class FirestoreTicketQueryService implements TicketQueryService {
  async findById(id: string): Promise<Ticket | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(TICKET_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseTicket(snap.id, snap.data())
      },
      { op: 'tickets.findById', resource: 'Ticket', id }
    )
  }

  async list(filter: TicketListFilter): Promise<TicketListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(TICKET_COLLECTION)
        if (filter.userId !== undefined) q = q.where('userId', '==', filter.userId)
        if (filter.status !== undefined) q = q.where('status', '==', filter.status)

        q = q.orderBy('createdAt', filter.sortDirection).orderBy('__name__', filter.sortDirection)

        if (filter.cursor) {
          q = q.startAfter(FsTimestamp.fromDate(filter.cursor.lastValue), filter.cursor.lastDocId)
        }

        q = q.limit(filter.limit + 1)
        const result = await q.get()
        const hasMore = result.size > filter.limit
        const docs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
        const items = docs.map((doc) => parseTicket(doc.id, doc.data()))

        let nextCursor: TicketListCursor | null = null
        if (hasMore) {
          const last = docs[docs.length - 1]!
          nextCursor = {
            sortField: 'createdAt',
            sortDirection: filter.sortDirection,
            lastValue: timestampField(last, 'createdAt').toDate(),
            lastDocId: last.id,
          }
        }

        return { items, nextCursor }
      },
      { op: 'tickets.list', resource: 'Ticket' }
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
export const firestoreTicketQueryService: TicketQueryService = new FirestoreTicketQueryService()
