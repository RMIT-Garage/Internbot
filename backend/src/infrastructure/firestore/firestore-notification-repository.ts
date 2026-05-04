import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { NotificationRepository } from '../../domain/repositories/notification-repository'
import { Notification, NOTIFICATION_SCHEMA_VERSION } from '../../domain/entities/notification'
import {
  emailDeliveryStatusValues,
  notificationTypeValues,
  type EmailDeliveryStatus,
  type NotificationType,
} from '../../domain/value-objects/notification-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

const notificationStorageSchema = z.object({
  userId: z.string().min(1),
  type: z.enum(notificationTypeValues),
  title: z.string().min(1),
  body: z.string().min(1),
  relatedInternshipId: z.string().optional(),
  relatedOpportunityId: z.string().optional(),
  relatedTicketId: z.string().optional(),
  emailDeliveryStatus: z.enum(emailDeliveryStatusValues).nullable().optional(),
  emailDeliveredAt: firestoreTimestamp.nullable().optional(),
  readAt: firestoreTimestamp.nullable().optional(),
  version: z.number().int().nonnegative().default(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

type NotificationStorage = z.infer<typeof notificationStorageSchema>
type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>

type NotificationCreateWrite = {
  userId: string
  type: NotificationType
  title: string
  body: string
  relatedInternshipId?: string
  relatedOpportunityId?: string
  relatedTicketId?: string
  emailDeliveryStatus: EmailDeliveryStatus | null
  emailDeliveredAt: Timestamp | null
  readAt: Timestamp | null
  version: number
  _schemaVersion: typeof NOTIFICATION_SCHEMA_VERSION
}

type NotificationCreateDoc = NotificationCreateWrite & {
  createdAt: ServerTimestamp
  updatedAt: ServerTimestamp
}
type NotificationUpdateWrite = {
  readAt: Timestamp | null
  emailDeliveryStatus: EmailDeliveryStatus | null
  emailDeliveredAt: Timestamp | null
  version: number
}
type NotificationUpdateDoc = NotificationUpdateWrite & { updatedAt: ServerTimestamp }

const COLLECTION = 'notifications'

function tsToDate(ts: Timestamp | null | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function mapStorageToNotification(id: string, storage: NotificationStorage): Notification {
  return Notification.rehydrate({
    id,
    version: storage.version,
    userId: storage.userId,
    type: storage.type,
    title: storage.title,
    body: storage.body,
    relatedInternshipId: storage.relatedInternshipId,
    relatedOpportunityId: storage.relatedOpportunityId,
    relatedTicketId: storage.relatedTicketId,
    emailDeliveryStatus: storage.emailDeliveryStatus ?? undefined,
    emailDeliveredAt: tsToDate(storage.emailDeliveredAt),
    readAt: tsToDate(storage.readAt),
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
  })
}

function notificationToCreatePayload(notification: Notification): NotificationCreateWrite {
  const out: NotificationCreateWrite = {
    userId: notification.userId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    emailDeliveryStatus: notification.emailDeliveryStatus ?? null,
    emailDeliveredAt: notification.emailDeliveredAt
      ? FsTimestamp.fromDate(notification.emailDeliveredAt)
      : null,
    readAt: notification.readAt ? FsTimestamp.fromDate(notification.readAt) : null,
    version: 1,
    _schemaVersion: NOTIFICATION_SCHEMA_VERSION,
  }
  if (notification.relatedInternshipId !== undefined) {
    out.relatedInternshipId = notification.relatedInternshipId
  }
  if (notification.relatedOpportunityId !== undefined) {
    out.relatedOpportunityId = notification.relatedOpportunityId
  }
  if (notification.relatedTicketId !== undefined) {
    out.relatedTicketId = notification.relatedTicketId
  }
  return out
}

export class FirestoreNotificationRepository implements NotificationRepository {
  constructor(private readonly txn: Transaction) {}

  async create(notification: Notification): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(notification.id)
        const doc: NotificationCreateDoc = {
          ...notificationToCreatePayload(notification),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'notifications.create', resource: 'Notification' }
    )
  }

  async save(notification: Notification): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(notification.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Notification', notification.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== notification.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: NotificationUpdateDoc = {
          readAt: notification.readAt ? FsTimestamp.fromDate(notification.readAt) : null,
          emailDeliveryStatus: notification.emailDeliveryStatus ?? null,
          emailDeliveredAt: notification.emailDeliveredAt
            ? FsTimestamp.fromDate(notification.emailDeliveredAt)
            : null,
          version: stored + 1,
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)
      },
      { op: 'notifications.save', resource: 'Notification', id: notification.id }
    )
  }
}

export function parseNotification(id: string, raw: unknown): Notification {
  const parsed = notificationStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`notifications/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToNotification(id, parsed.data)
}
