import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, adminDb } from '../config/firebase-admin'
import type { TicketRepository } from '../../domain/repositories/ticket-repository'
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

export const ticketStorageSchema = z.object({
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

export const TICKET_COLLECTION = 'tickets'

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
        const ref = adminDb.collection(TICKET_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseTicket(snap.id, snap.data())
      },
      { op: 'tickets.findById', resource: 'Ticket', id }
    )
  }

  /**
   * Upsert. `aggregate.version === 0` → first-write path: writes the ticket
   * doc (the historical `create`). Else → optimistic-lock update path:
   * drains pending transition (rotate version + activity row) or pending
   * reply (bump updatedAt only — replies don't rotate version).
   */
  async save(ticket: Ticket): Promise<void> {
    if (ticket.version === 0) {
      await this.insertNew(ticket)
      return
    }
    await this.updateExisting(ticket)
  }

  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(TICKET_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Ticket', id)
        this.txn.delete(ref)
      },
      { op: 'tickets.delete', resource: 'Ticket', id }
    )
  }

  private async insertNew(ticket: Ticket): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(TICKET_COLLECTION).doc(ticket.id)
        const doc: TicketCreateDoc = {
          ...ticketToCreatePayload(ticket),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'tickets.save', resource: 'Ticket', id: ticket.id }
    )
  }

  private async updateExisting(ticket: Ticket): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(TICKET_COLLECTION).doc(ticket.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Ticket', ticket.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== ticket.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const transitionActivity = ticket.pendingActivity
        if (transitionActivity) {
          const update: TicketUpdateDoc = {
            status: ticket.status,
            version: stored + 1,
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
          this.txn.set(ref.collection('activity').doc(transitionActivity.id), {
            ...activityToPayload(transitionActivity),
            createdAt: FieldValue.serverTimestamp(),
          } satisfies TicketActivityDoc)
        }

        const reply = ticket.pendingReply
        if (reply) {
          // Replies do not rotate version — bump updatedAt only.
          this.txn.update(ref, { updatedAt: FieldValue.serverTimestamp() })
          this.txn.set(ref.collection('replies').doc(reply.id), {
            ...replyToPayload(reply),
            createdAt: FieldValue.serverTimestamp(),
          } satisfies TicketReplyDoc)
        }
      },
      { op: 'tickets.save', resource: 'Ticket', id: ticket.id }
    )
  }
}

export function parseTicket(id: string, raw: unknown): Ticket {
  const parsed = ticketStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`tickets/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToTicket(id, parsed.data)
}
