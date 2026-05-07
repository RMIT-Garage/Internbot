import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { InternshipRepository } from '../../domain/repositories/internship-repository'
import {
  Attachment,
  ATTACHMENT_SCHEMA_VERSION,
  type AttachmentProps,
} from '../../domain/value-objects/attachment'
import { Internship, INTERNSHIP_SCHEMA_VERSION } from '../../domain/entities/internship'
import type { InternshipActivity } from '../../domain/value-objects/internship-activity'
import {
  internshipCoordinatorDecisionValues,
  internshipStatusValues,
  type InternshipCoordinatorDecision,
  type InternshipActivityType,
  type InternshipStatus,
} from '../../domain/value-objects/internship-enums'
import type { Role } from '../../domain/value-objects/user-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

export const internshipStorageSchema = z.object({
  userId: z.string().min(1),
  opportunityId: z.string().min(1),
  offerDate: firestoreTimestamp.optional(),
  startDate: firestoreTimestamp.optional(),
  endDate: firestoreTimestamp.optional(),
  status: z.enum(internshipStatusValues),
  version: z.number().int().nonnegative().default(0),
  coordinatorDecision: z.enum(internshipCoordinatorDecisionValues).nullable().optional(),
  coordinatorComment: z.string().nullable().optional(),
  reviewedByUserId: z.string().nullable().optional(),
  reviewedAt: firestoreTimestamp.nullable().optional(),
  lastSubmittedAt: firestoreTimestamp.optional(),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

export const internshipAttachmentStorageSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  uploadedAt: firestoreTimestamp,
  storageGeneration: z.string().optional(),
  deletedAt: firestoreTimestamp.optional(),
  deletedByUserId: z.string().optional(),
  _schemaVersion: z.number().int().optional(),
})

type InternshipStorage = z.infer<typeof internshipStorageSchema>
type AttachmentStorage = z.infer<typeof internshipAttachmentStorageSchema>

type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>
type DeleteField = ReturnType<typeof FieldValue.delete>

type InternshipCreateWrite = {
  userId: string
  opportunityId: string
  status: InternshipStatus
  version: number
  _schemaVersion: typeof INTERNSHIP_SCHEMA_VERSION
}
type InternshipCreateDoc = InternshipCreateWrite & {
  createdAt: ServerTimestamp
  updatedAt: ServerTimestamp
}

type InternshipUpdateWrite = {
  status: InternshipStatus
  version: number
  offerDate: Timestamp | DeleteField
  startDate: Timestamp | DeleteField
  endDate: Timestamp | DeleteField
  coordinatorDecision: InternshipCoordinatorDecision | DeleteField
  coordinatorComment: string | DeleteField
  reviewedByUserId: string | DeleteField
  reviewedAt: Timestamp | DeleteField
  lastSubmittedAt: Timestamp | DeleteField
}
type InternshipUpdateDoc = InternshipUpdateWrite & { updatedAt: ServerTimestamp }

type InternshipApplicationSentinelDoc = {
  internshipId: string
  userId: string
  opportunityId: string
  createdAt: ServerTimestamp
  _schemaVersion: typeof INTERNSHIP_SCHEMA_VERSION
}

type InternshipActivityWrite = {
  type: InternshipActivityType
  authorUserId: string
  authorRole: Role
  text?: string
  _schemaVersion: typeof INTERNSHIP_SCHEMA_VERSION
}
type InternshipActivityDoc = InternshipActivityWrite & {
  createdAt: Timestamp | ServerTimestamp
}
type AttachmentWrite = {
  filePath: string
  fileName?: string
  contentType?: string
  storageGeneration?: string
  _schemaVersion: typeof ATTACHMENT_SCHEMA_VERSION
}
type AttachmentDoc = AttachmentWrite & { uploadedAt: Timestamp | ServerTimestamp }
type AttachmentSoftDeleteUpdate = {
  deletedAt: Timestamp
  deletedByUserId: string
}

export const INTERNSHIP_COLLECTION = 'internships'
export const INTERNSHIP_SENTINEL_COLLECTION = 'internshipApplications'

function tsToDate(ts: Timestamp | null | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

export function sentinelDocId(userId: string, opportunityId: string): string {
  return `${encodeURIComponent(userId)}__${encodeURIComponent(opportunityId)}`
}

function dateToWrite(date: Date | undefined): Timestamp | DeleteField {
  return date ? FsTimestamp.fromDate(date) : FieldValue.delete()
}

function mapStorageToInternship(
  id: string,
  storage: InternshipStorage,
  attachments: readonly Attachment[]
): Internship {
  return Internship.rehydrate(
    {
      id,
      version: storage.version,
      userId: storage.userId,
      opportunityId: storage.opportunityId,
      offerDate: tsToDate(storage.offerDate),
      startDate: tsToDate(storage.startDate),
      endDate: tsToDate(storage.endDate),
      status: storage.status,
      coordinatorDecision: storage.coordinatorDecision ?? undefined,
      coordinatorComment: storage.coordinatorComment ?? undefined,
      reviewedByUserId: storage.reviewedByUserId ?? undefined,
      reviewedAt: tsToDate(storage.reviewedAt),
      lastSubmittedAt: tsToDate(storage.lastSubmittedAt),
      createdAt: storage.createdAt.toDate(),
      updatedAt: storage.updatedAt.toDate(),
    },
    attachments
  )
}

function internshipToCreatePayload(internship: Internship): InternshipCreateWrite {
  return {
    userId: internship.userId,
    opportunityId: internship.opportunityId,
    status: internship.status,
    version: 1,
    _schemaVersion: INTERNSHIP_SCHEMA_VERSION,
  }
}

function internshipToUpdatePayload(
  internship: Internship,
  nextVersion: number
): InternshipUpdateWrite {
  return {
    status: internship.status,
    version: nextVersion,
    offerDate: dateToWrite(internship.offerDate),
    startDate: dateToWrite(internship.startDate),
    endDate: dateToWrite(internship.endDate),
    coordinatorDecision: internship.coordinatorDecision ?? FieldValue.delete(),
    coordinatorComment: internship.coordinatorComment ?? FieldValue.delete(),
    reviewedByUserId: internship.reviewedByUserId ?? FieldValue.delete(),
    reviewedAt: dateToWrite(internship.reviewedAt),
    lastSubmittedAt: dateToWrite(internship.lastSubmittedAt),
  }
}

function activityToPayload(activity: InternshipActivity): InternshipActivityWrite {
  return {
    type: activity.type,
    authorUserId: activity.authorUserId,
    authorRole: activity.authorRole,
    ...(activity.text !== undefined ? { text: activity.text } : {}),
    _schemaVersion: INTERNSHIP_SCHEMA_VERSION,
  }
}

function attachmentToPayload(attachment: Attachment): AttachmentDoc {
  return {
    filePath: attachment.filePath,
    ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
    ...(attachment.contentType !== undefined ? { contentType: attachment.contentType } : {}),
    ...(attachment.storageGeneration !== undefined
      ? { storageGeneration: attachment.storageGeneration }
      : {}),
    uploadedAt: FsTimestamp.fromDate(attachment.uploadedAt),
    _schemaVersion: ATTACHMENT_SCHEMA_VERSION,
  }
}

export class FirestoreInternshipRepository implements InternshipRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Internship | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(INTERNSHIP_COLLECTION).doc(id)
        // All reads must precede writes within a Firestore transaction;
        // eager-loading attachments here keeps the aggregate self-contained
        // for invariant checks (e.g. `softDeleteAttachment`, `submitOffer`'s
        // attachment requirement) without leaking a second `txn.get` into
        // every handler.
        const [parentSnap, attachmentSnap] = await Promise.all([
          this.txn.get(ref),
          this.txn.get(ref.collection('attachments').orderBy('uploadedAt', 'asc')),
        ])
        if (!parentSnap.exists) return null
        const attachments = attachmentSnap.docs.map((doc) =>
          parseInternshipAttachment(doc.id, doc.data())
        )
        return parseInternship(parentSnap.id, parentSnap.data(), attachments)
      },
      { op: 'internships.findById', resource: 'Internship', id }
    )
  }

  async findByUserIdAndOpportunityId(
    userId: string,
    opportunityId: string
  ): Promise<Internship | null> {
    return translateFirestoreErrors(
      async () => {
        const query = adminDb
          .collection(INTERNSHIP_COLLECTION)
          .where('userId', '==', userId)
          .where('opportunityId', '==', opportunityId)
          .limit(1)
        const snap = await this.txn.get(query)
        const doc = snap.docs[0]
        if (!doc) return null
        // Uniqueness check, not full hydration — callers that mutate
        // should re-load via findById to get the attachments subcollection.
        return parseInternship(doc.id, doc.data(), [])
      },
      { op: 'internships.findByUserIdAndOpportunityId', resource: 'Internship' }
    )
  }

  /** Upsert. `version === 0` → first-write; else optimistic-lock update. */
  async save(internship: Internship): Promise<void> {
    if (internship.version === 0) {
      await this.insertNew(internship)
      return
    }
    await this.updateExisting(internship)
  }

  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(INTERNSHIP_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Internship', id)
        const data = snap.data()
        const userId = data?.['userId'] as string | undefined
        const opportunityId = data?.['opportunityId'] as string | undefined
        if (userId && opportunityId) {
          const sentinelRef = adminDb
            .collection(INTERNSHIP_SENTINEL_COLLECTION)
            .doc(sentinelDocId(userId, opportunityId))
          this.txn.delete(sentinelRef)
        }
        this.txn.delete(ref)
      },
      { op: 'internships.delete', resource: 'Internship', id }
    )
  }

  private async insertNew(internship: Internship): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(INTERNSHIP_COLLECTION).doc(internship.id)
        const sentinelRef = adminDb
          .collection(INTERNSHIP_SENTINEL_COLLECTION)
          .doc(sentinelDocId(internship.userId, internship.opportunityId))
        const doc: InternshipCreateDoc = {
          ...internshipToCreatePayload(internship),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        const sentinel: InternshipApplicationSentinelDoc = {
          internshipId: internship.id,
          userId: internship.userId,
          opportunityId: internship.opportunityId,
          createdAt: FieldValue.serverTimestamp(),
          _schemaVersion: INTERNSHIP_SCHEMA_VERSION,
        }
        this.txn.create(ref, doc)
        this.txn.create(sentinelRef, sentinel)

        const activity = internship.pendingActivity
        if (activity) {
          this.txn.set(ref.collection('activity').doc(activity.id), {
            ...activityToPayload(activity),
            createdAt: FieldValue.serverTimestamp(),
          } satisfies InternshipActivityDoc)
        }
      },
      {
        op: 'internships.save',
        resource: 'Internship',
        id: internship.id,
        conflictReason: 'duplicate_application',
      }
    )
  }

  private async updateExisting(internship: Internship): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(INTERNSHIP_COLLECTION).doc(internship.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Internship', internship.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== internship.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        // Parent-mutation saves rotate version + write the full update doc.
        // Comment-only saves (pendingActivity set without hasParentMutation)
        // append the activity row without touching parent state, matching
        // the historical `addActivity` ETag-stable semantics.
        if (internship.hasParentMutation) {
          const update: InternshipUpdateDoc = {
            ...internshipToUpdatePayload(internship, stored + 1),
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
        }

        const activity = internship.pendingActivity
        if (activity) {
          this.txn.set(ref.collection('activity').doc(activity.id), {
            ...activityToPayload(activity),
            createdAt: FieldValue.serverTimestamp(),
          } satisfies InternshipActivityDoc)
        }

        for (const added of internship.pendingAttachmentAdds) {
          this.txn.set(ref.collection('attachments').doc(added.id), attachmentToPayload(added))
        }

        for (const tombstone of internship.pendingAttachmentSoftDeletes) {
          const attachmentRef = ref.collection('attachments').doc(tombstone.attachmentId)
          this.txn.update(attachmentRef, {
            deletedAt: FsTimestamp.fromDate(tombstone.deletedAt),
            deletedByUserId: tombstone.deletedByUserId,
          } satisfies AttachmentSoftDeleteUpdate)
        }
      },
      { op: 'internships.save', resource: 'Internship', id: internship.id }
    )
  }
}

export function parseInternship(
  id: string,
  raw: unknown,
  attachments: readonly Attachment[] = []
): Internship {
  const parsed = internshipStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`internships/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToInternship(id, parsed.data, attachments)
}

export function parseInternshipAttachment(id: string, raw: unknown): Attachment {
  const parsed = internshipAttachmentStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `internships/*/attachments/${id} storage-shape validation failed: ${parsed.error.message}`
    )
  }
  const data: AttachmentStorage = parsed.data
  const props: AttachmentProps = {
    id,
    filePath: data.filePath,
    fileName: data.fileName,
    contentType: data.contentType,
    uploadedAt: data.uploadedAt.toDate(),
    storageGeneration: data.storageGeneration,
    deletedAt: data.deletedAt ? data.deletedAt.toDate() : undefined,
    deletedByUserId: data.deletedByUserId,
  }
  return Attachment.rehydrate(props)
}
