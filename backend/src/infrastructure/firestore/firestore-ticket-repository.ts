import { z } from 'zod'
import {
  Timestamp,
  type Query,
  type QueryDocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type {
  TicketListCursor,
  TicketListFilter,
  TicketListPage,
  TicketRepository,
} from '../../domain/repositories/ticket-repository'
import { Ticket, TICKET_SCHEMA_VERSION } from '../../domain/entities/ticket'
import type { TicketActivity } from '../../domain/value-objects/ticket-activity'
import type { TicketReply } from '../../domain/value-objects/ticket-reply'
import {
  ticketStatusValues,
  type TicketActivityType,
  type TicketStatus,
} from '../../domain/value-objects/ticket-enums'
import type { Role } from '../../domain/value-objects/user-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

const ticketStorageSchema = z.object({
  userId: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
  category: z.string().nullable().optional(),
  status: z.enum(ticketStatusValues),
  version: z.number().int().nonnegative().default(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

type TicketStorage = z.infer<typeof ticketStorageSchema>
type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>

type TicketCreateWrite = {
  userId: string
  subject: string
  body: string
  category?: string
  status: TicketStatus
  version: number
  _schemaVersion: typeof TICKET_SCHEMA_VERSION
}
type TicketCreateDoc = TicketCreateWrite & {
  createdAt: ServerTimestamp
  updatedAt: ServerTimestamp
}
type TicketUpdateDoc = {
  status: TicketStatus
  version: number
  updatedAt: ServerTimestamp
}

type TicketActivityWrite = {
  type: TicketActivityType
  from: TicketStatus
  to: TicketStatus
  actorUserId: string
  actorRole: Role
  comment?: string
  _schemaVersion: typeof TICKET_SCHEMA_VERSION
}
type TicketActivityDoc = TicketActivityWrite & { createdAt: Timestamp | ServerTimestamp }

type TicketReplyWrite = {
  authorUserId: string
  authorRole: Role
  text: string
  _schemaVersion: typeof TICKET_SCHEMA_VERSION
}
type TicketReplyDoc = TicketReplyWrite & { createdAt: Timestamp | ServerTimestamp }

const COLLECTION = 'tickets'

function mapStorageToTicket(id: string, storage: TicketStorage): Ticket {
  return Ticket.rehydrate({
    id,
    version: storage.version,
    userId: storage.userId,
    subject: storage.subject,
    body: storage.body,
    category: storage.category ?? undefined,
    status: storage.status,
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
  })
}

function ticketToCreatePayload(ticket: Ticket): TicketCreateWrite {
  const out: TicketCreateWrite = {
    userId: ticket.userId,
    subject: ticket.subject,
    body: ticket.body,
    status: ticket.status,
    version: 1,
    _schemaVersion: TICKET_SCHEMA_VERSION,
  }
  if (ticket.category !== undefined) out.category = ticket.category
  return out
}

function activityToPayload(activity: TicketActivity): TicketActivityWrite {
  const out: TicketActivityWrite = {
    type: activity.type,
    from: activity.from,
    to: activity.to,
    actorUserId: activity.actorUserId,
    actorRole: activity.actorRole,
    _schemaVersion: TICKET_SCHEMA_VERSION,
  }
  if (activity.comment !== undefined) out.comment = activity.comment
  return out
}

function replyToPayload(reply: TicketReply): TicketReplyWrite {
  return {
    authorUserId: reply.authorUserId,
    authorRole: reply.authorRole,
    text: reply.text,
    _schemaVersion: TICKET_SCHEMA_VERSION,
  }
}

export class FirestoreTicketRepository implements TicketRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Ticket | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseTicket(snap.id, snap.data())
      },
      { op: 'tickets.findById', resource: 'Ticket', id }
    )
  }

  async list(filter: TicketListFilter): Promise<TicketListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(COLLECTION)
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

  async create(ticket: Ticket): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(ticket.id)
        const doc: TicketCreateDoc = {
          ...ticketToCreatePayload(ticket),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'tickets.create', resource: 'Ticket', id: ticket.id }
    )
  }

  async applyTransition(ticket: Ticket, activity: TicketActivity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(ticket.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Ticket', ticket.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== ticket.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: TicketUpdateDoc = {
          status: ticket.status,
          version: stored + 1,
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)

        this.txn.set(ref.collection('activity').doc(activity.id), {
          ...activityToPayload(activity),
          createdAt: FieldValue.serverTimestamp(),
        } satisfies TicketActivityDoc)
      },
      { op: 'tickets.applyTransition', resource: 'Ticket', id: ticket.id }
    )
  }

  async addReply(ticketId: string, reply: TicketReply, _now: Date): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(ticketId)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Ticket', ticketId)

        // Bump updatedAt without rotating version — replies do not change
        // the ETag-protected ticket state.
        this.txn.update(ref, { updatedAt: FieldValue.serverTimestamp() })

        this.txn.set(ref.collection('replies').doc(reply.id), {
          ...replyToPayload(reply),
          createdAt: FieldValue.serverTimestamp(),
        } satisfies TicketReplyDoc)
      },
      { op: 'tickets.addReply', resource: 'Ticket', id: ticketId }
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

export function parseTicket(id: string, raw: unknown): Ticket {
  const parsed = ticketStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`tickets/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToTicket(id, parsed.data)
}
