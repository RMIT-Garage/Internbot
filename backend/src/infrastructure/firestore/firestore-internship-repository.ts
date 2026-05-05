import { z } from 'zod'
import { Timestamp, type Query, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type {
  InternshipAttachment,
  InternshipListCursor,
  InternshipListFilter,
  InternshipListPage,
  InternshipRepository,
} from '../../domain/repositories/internship-repository'
import { Internship, INTERNSHIP_SCHEMA_VERSION } from '../../domain/entities/internship'
import type { InternshipActivity } from '../../domain/value-objects/internship-activity'
import {
  internshipCoordinatorDecisionValues,
  internshipStatusValues,
  type InternshipActivityType,
  type InternshipStatus,
} from '../../domain/value-objects/internship-enums'
import type { Role } from '../../domain/value-objects/user-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

const internshipStorageSchema = z.object({
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

const attachmentStorageSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  uploadedAt: firestoreTimestamp,
  _schemaVersion: z.number().int().optional(),
})

type InternshipStorage = z.infer<typeof internshipStorageSchema>
type AttachmentStorage = z.infer<typeof attachmentStorageSchema>

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

const COLLECTION = 'internships'
const SENTINEL_COLLECTION = 'internshipApplications'

function tsToDate(ts: Timestamp | null | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function sentinelDocId(userId: string, opportunityId: string): string {
  return `${encodeURIComponent(userId)}__${encodeURIComponent(opportunityId)}`
}

function dateToWrite(date: Date | undefined): Timestamp | DeleteField {
  return date ? FsTimestamp.fromDate(date) : FieldValue.delete()
}

function mapStorageToInternship(id: string, storage: InternshipStorage): Internship {
  return Internship.rehydrate({
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
  })
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

export class FirestoreInternshipRepository implements InternshipRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Internship | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseInternship(snap.id, snap.data())
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
        const snap = await this.txn.get(
          adminDb
            .collection(COLLECTION)
            .where('userId', '==', userId)
            .where('opportunityId', '==', opportunityId)
            .limit(1)
        )
        const doc = snap.docs[0]
        return doc ? parseInternship(doc.id, doc.data()) : null
      },
      {
        op: 'internships.findByUserIdAndOpportunityId',
        resource: 'Internship',
      }
    )
  }

  async list(filter: InternshipListFilter): Promise<InternshipListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(COLLECTION)

        if (filter.userId !== undefined) q = q.where('userId', '==', filter.userId)
        if (filter.opportunityId !== undefined) {
          q = q.where('opportunityId', '==', filter.opportunityId)
        }
        if (filter.status && filter.status.length > 0) {
          q =
            filter.status.length === 1
              ? q.where('status', '==', filter.status[0])
              : q.where('status', 'in', [...filter.status])
        }

        q = q
          .orderBy(filter.sortField, filter.sortDirection)
          .orderBy('__name__', filter.sortDirection)

        if (filter.cursor) {
          q = q.startAfter(filter.cursor.lastValue ?? null, filter.cursor.lastDocId)
        }

        q = q.limit(filter.limit + 1)
        const result = await q.get()
        const hasMore = result.size > filter.limit
        const docs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
        const items = docs.map((doc) => parseInternship(doc.id, doc.data()))

        let nextCursor: InternshipListCursor | null = null
        if (hasMore) {
          const last = docs[docs.length - 1]!
          const value = last.data()[filter.sortField]
          const lastValue = value && typeof value.toDate === 'function' ? value.toDate() : null
          nextCursor = {
            sortField: filter.sortField,
            sortDirection: filter.sortDirection,
            lastValue,
            lastDocId: last.id,
          }
        }

        return { items, nextCursor }
      },
      { op: 'internships.list', resource: 'Internship' }
    )
  }

  async listByUserId(userId: string): Promise<readonly Internship[]> {
    return translateFirestoreErrors(
      async () => {
        const snap = await this.txn.get(
          adminDb.collection(COLLECTION).where('userId', '==', userId)
        )
        return snap.docs.map((doc) => parseInternship(doc.id, doc.data()))
      },
      { op: 'internships.listByUserId', resource: 'Internship' }
    )
  }

  async listAttachments(internshipId: string): Promise<readonly InternshipAttachment[]> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection(COLLECTION)
          .doc(internshipId)
          .collection('attachments')
          .orderBy('uploadedAt', 'asc')
          .get()
        return snap.docs.map((doc) => parseAttachment(doc.id, doc.data()))
      },
      { op: 'internships.listAttachments', resource: 'Internship', id: internshipId }
    )
  }

  async hasAttachments(internshipId: string): Promise<boolean> {
    return translateFirestoreErrors(
      async () => {
        const snap = await this.txn.get(
          adminDb.collection(COLLECTION).doc(internshipId).collection('attachments').limit(1)
        )
        return !snap.empty
      },
      { op: 'internships.hasAttachments', resource: 'Internship', id: internshipId }
    )
  }

  async create(internship: Internship): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(internship.id)
        const sentinelRef = adminDb
          .collection(SENTINEL_COLLECTION)
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
        op: 'internships.create',
        resource: 'Internship',
        id: internship.id,
        conflictReason: 'duplicate_application',
      }
    )
  }

  async save(internship: Internship): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(internship.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Internship', internship.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== internship.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: InternshipUpdateDoc = {
          ...internshipToUpdatePayload(internship, stored + 1),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)

        const activity = internship.pendingActivity
        if (activity) {
          this.txn.set(ref.collection('activity').doc(activity.id), {
            ...activityToPayload(activity),
            createdAt: FieldValue.serverTimestamp(),
          } satisfies InternshipActivityDoc)
        }
      },
      { op: 'internships.save', resource: 'Internship', id: internship.id }
    )
  }

  async addActivity(internshipId: string, activity: InternshipActivity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb
          .collection(COLLECTION)
          .doc(internshipId)
          .collection('activity')
          .doc(activity.id)
        this.txn.set(ref, {
          ...activityToPayload(activity),
          createdAt: FieldValue.serverTimestamp(),
        } satisfies InternshipActivityDoc)
      },
      { op: 'internships.addActivity', resource: 'Internship', id: internshipId }
    )
  }
}

function parseInternship(id: string, raw: unknown): Internship {
  const parsed = internshipStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`internships/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToInternship(id, parsed.data)
}

function parseAttachment(id: string, raw: unknown): InternshipAttachment {
  const parsed = attachmentStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `internships/*/attachments/${id} storage-shape validation failed: ${parsed.error.message}`
    )
  }
  const data: AttachmentStorage = parsed.data
  return {
    id,
    fileName: data.fileName,
    contentType: data.contentType,
    uploadedAt: data.uploadedAt.toDate(),
  }
}
