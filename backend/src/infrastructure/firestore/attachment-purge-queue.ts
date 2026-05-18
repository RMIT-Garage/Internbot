import type { Timestamp } from 'firebase-admin/firestore'
import { FieldValue, type adminDb } from '../config/firebase-admin'

/**
 * Transactional outbox for hard-deleted attachments. Each row is written by
 * the originating aggregate's `save()` inside the same Firestore transaction
 * that hard-deletes the attachment subdoc, so the queue is always consistent
 * with the visible state. A separate worker drains the queue and deletes the
 * underlying GCS object using `filePath` + `storageGeneration`
 * (`ifGenerationMatch` keeps the delete safe across re-uploads).
 */
export const ATTACHMENT_PURGE_QUEUE_COLLECTION = 'attachmentPurgeQueue'
export const ATTACHMENT_PURGE_QUEUE_SCHEMA_VERSION = 1 as const

type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>

export type AttachmentPurgeParent = 'internships' | 'opportunities'

export interface AttachmentPurgeQueueDoc {
  parentCollection: AttachmentPurgeParent
  parentId: string
  attachmentId: string
  filePath: string
  storageGeneration?: string
  requestedByUserId: string
  requestedAt: ServerTimestamp | Timestamp
  status: 'pending'
  _schemaVersion: typeof ATTACHMENT_PURGE_QUEUE_SCHEMA_VERSION
}

export interface AttachmentPurgeRequestInput {
  readonly parentCollection: AttachmentPurgeParent
  readonly parentId: string
  readonly attachmentId: string
  readonly filePath: string
  readonly storageGeneration: string | undefined
  readonly requestedByUserId: string
}

export function buildAttachmentPurgeQueueDoc(
  input: AttachmentPurgeRequestInput
): AttachmentPurgeQueueDoc {
  const doc: AttachmentPurgeQueueDoc = {
    parentCollection: input.parentCollection,
    parentId: input.parentId,
    attachmentId: input.attachmentId,
    filePath: input.filePath,
    requestedByUserId: input.requestedByUserId,
    requestedAt: FieldValue.serverTimestamp(),
    status: 'pending',
    _schemaVersion: ATTACHMENT_PURGE_QUEUE_SCHEMA_VERSION,
  }
  if (input.storageGeneration !== undefined) {
    doc.storageGeneration = input.storageGeneration
  }
  return doc
}

/**
 * Returns a fresh DocumentReference in the purge queue collection. Used by
 * repos that need to `txn.create(...)` an outbox row alongside their main
 * write. Caller passes their `adminDb` so this module stays free of
 * test-time imports.
 */
export function newAttachmentPurgeQueueRef(db: typeof adminDb) {
  return db.collection(ATTACHMENT_PURGE_QUEUE_COLLECTION).doc()
}
