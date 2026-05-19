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

export const notificationStorageSchema = z.object({
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

export const NOTIFICATION_COLLECTION = 'notifications'

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

function notificationToUpdatePayload(
  notification: Notification,
  nextVersion: number
): NotificationUpdateWrite {
  return {
    readAt: notification.readAt ? FsTimestamp.fromDate(notification.readAt) : null,
    emailDeliveryStatus: notification.emailDeliveryStatus ?? null,
    emailDeliveredAt: notification.emailDeliveredAt
      ? FsTimestamp.fromDate(notification.emailDeliveredAt)
      : null,
    version: nextVersion,
  }
}

export class FirestoreNotificationRepository implements NotificationRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Notification | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(NOTIFICATION_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseNotification(snap.id, snap.data())
      },
      { op: 'notifications.findById', resource: 'Notification', id }
    )
  }

  /**
   * Unread notifications for a user, read inside the active txn. Used by
   * the bulk mark-all-read command — load → `markRead(now)` per aggregate
   * → `save` per aggregate, all in the same Firestore transaction.
   */
  async listUnreadByUserId(userId: string): Promise<readonly Notification[]> {
    return translateFirestoreErrors(
      async () => {
        const query = adminDb
          .collection(NOTIFICATION_COLLECTION)
          .where('userId', '==', userId)
          .where('readAt', '==', null)
        const snap = await this.txn.get(query)
        return snap.docs.map((doc) => parseNotification(doc.id, doc.data()))
      },
      { op: 'notifications.listUnreadByUserId', resource: 'Notification' }
    )
  }

  /** Upsert. `version === 0` → first-write; else optimistic-lock update. */
  async save(notification: Notification): Promise<void> {
    if (notification.version === 0) {
      await this.insertNew(notification)
      return
    }
    await this.updateExisting(notification)
  }

  /**
   * Write-only bulk update for notifications already loaded via
   * `listUnreadByUserId` in the same txn. Skips the per-doc `txn.get`
   * that `save` does for its version check, so it is safe to invoke after
   * other writes have been queued (reads-before-writes is preserved by
   * the caller doing all reads up front).
   */
  async applyMarkReadBatch(notifications: readonly Notification[]): Promise<void> {
    if (notifications.length === 0) return
    await translateFirestoreErrors(
      async () => {
        for (const notification of notifications) {
          const ref = adminDb.collection(NOTIFICATION_COLLECTION).doc(notification.id)
          const update: NotificationUpdateDoc = {
            ...notificationToUpdatePayload(notification, notification.version + 1),
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
        }
      },
      { op: 'notifications.applyMarkReadBatch', resource: 'Notification' }
    )
  }

  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(NOTIFICATION_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Notification', id)
        this.txn.delete(ref)
      },
      { op: 'notifications.delete', resource: 'Notification', id }
    )
  }

  private async insertNew(notification: Notification): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(NOTIFICATION_COLLECTION).doc(notification.id)
        const doc: NotificationCreateDoc = {
          ...notificationToCreatePayload(notification),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'notifications.save', resource: 'Notification', id: notification.id }
    )
  }

  private async updateExisting(notification: Notification): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(NOTIFICATION_COLLECTION).doc(notification.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Notification', notification.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== notification.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: NotificationUpdateDoc = {
          ...notificationToUpdatePayload(notification, stored + 1),
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
