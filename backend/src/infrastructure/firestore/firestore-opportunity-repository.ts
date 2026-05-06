import { z } from 'zod'
import { Timestamp, type Query, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type {
  OpportunityAttachment,
  OpportunityListCursor,
  OpportunityListFilter,
  OpportunityListPage,
  OpportunityRepository,
} from '../../domain/repositories/opportunity-repository'
import {
  Attachment,
  ATTACHMENT_SCHEMA_VERSION,
  type AttachmentProps,
} from '../../domain/value-objects/attachment'
import { Opportunity, OPPORTUNITY_SCHEMA_VERSION } from '../../domain/entities/opportunity'
import type { OpportunityTransition } from '../../domain/value-objects/opportunity-transition'
import type { OpportunityVerification } from '../../domain/value-objects/opportunity-verification'
import {
  opportunityStatusValues,
  opportunityTypeValues,
  workModeValues,
  type OpportunityActivityType,
  type OpportunityStatus,
  type OpportunityType,
  type WorkMode,
} from '../../domain/value-objects/opportunity-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

const opportunityStorageSchema = z.object({
  semesterId: z.string().min(1),
  type: z.enum(opportunityTypeValues),
  employerName: z.string().min(1),
  jobTitle: z.string().min(1),
  descriptionText: z.string().min(1),
  workMode: z.enum(workModeValues).optional(),
  location: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  status: z.enum(opportunityStatusValues),
  createdByUserId: z.string().optional(),
  submittedByUserId: z.string().optional(),
  verifiedByUserId: z.string().optional(),
  verifiedAt: firestoreTimestamp.optional(),
  version: z.number().int().nonnegative().default(0),
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

type OpportunityStorage = z.infer<typeof opportunityStorageSchema>
type AttachmentStorage = z.infer<typeof attachmentStorageSchema>

type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>
type DeleteField = ReturnType<typeof FieldValue.delete>

type OpportunityCreateWrite = {
  semesterId: string
  type: OpportunityType
  employerName: string
  jobTitle: string
  descriptionText: string
  status: OpportunityStatus
  version: number
  _schemaVersion: typeof OPPORTUNITY_SCHEMA_VERSION
  workMode?: WorkMode
  location?: string
  sourceUrl?: string
  createdByUserId?: string
  submittedByUserId?: string
  verifiedByUserId?: string
  verifiedAt?: Timestamp
}

type OpportunityUpdateWrite = {
  employerName: string
  jobTitle: string
  descriptionText: string
  version: number
  workMode: WorkMode | DeleteField
  location: string | DeleteField
  sourceUrl: string | DeleteField
}

type OpportunityTransitionWrite = {
  status: OpportunityStatus
  version: number
}

type OpportunityVerificationWrite = {
  status: OpportunityStatus
  verifiedByUserId: string
  verifiedAt: ServerTimestamp
  version: number
}

type OpportunityCreateDoc = OpportunityCreateWrite & {
  createdAt: ServerTimestamp
  updatedAt: ServerTimestamp
}
type OpportunityUpdateDoc = OpportunityUpdateWrite & { updatedAt: ServerTimestamp }
type OpportunityTransitionDoc = OpportunityTransitionWrite & { updatedAt: ServerTimestamp }
type OpportunityVerificationDoc = OpportunityVerificationWrite & { updatedAt: ServerTimestamp }
type AttachmentWrite = {
  filePath: string
  fileName?: string
  contentType?: string
  _schemaVersion: typeof ATTACHMENT_SCHEMA_VERSION
}
type AttachmentDoc = AttachmentWrite & { uploadedAt: Timestamp | ServerTimestamp }

type OpportunityActivityWrite = {
  type: OpportunityActivityType
  from: OpportunityStatus
  to: OpportunityStatus
  actorUserId: string
  authorUserId: string
  authorRole: 'coordinator'
  comment?: string
  decision?: string
  _schemaVersion: typeof OPPORTUNITY_SCHEMA_VERSION
}
type OpportunityActivityDoc = OpportunityActivityWrite & { createdAt: ServerTimestamp }

const COLLECTION = 'opportunities'

function tsToDate(ts: Timestamp | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function mapStorageToOpportunity(id: string, storage: OpportunityStorage): Opportunity {
  return Opportunity.rehydrate({
    id,
    version: storage.version,
    semesterId: storage.semesterId,
    type: storage.type,
    employerName: storage.employerName,
    jobTitle: storage.jobTitle,
    descriptionText: storage.descriptionText,
    workMode: storage.workMode,
    location: storage.location,
    sourceUrl: storage.sourceUrl,
    status: storage.status,
    createdByUserId: storage.createdByUserId,
    submittedByUserId: storage.submittedByUserId,
    verifiedByUserId: storage.verifiedByUserId,
    verifiedAt: tsToDate(storage.verifiedAt),
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
  })
}

function opportunityToCreatePayload(o: Opportunity): OpportunityCreateWrite {
  const out: OpportunityCreateWrite = {
    semesterId: o.semesterId,
    type: o.type,
    employerName: o.employerName,
    jobTitle: o.jobTitle,
    descriptionText: o.descriptionText,
    status: o.status,
    version: 1,
    _schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
  }
  if (o.workMode !== undefined) out.workMode = o.workMode
  if (o.location !== undefined) out.location = o.location
  if (o.sourceUrl !== undefined) out.sourceUrl = o.sourceUrl
  if (o.createdByUserId !== undefined) out.createdByUserId = o.createdByUserId
  if (o.submittedByUserId !== undefined) out.submittedByUserId = o.submittedByUserId
  if (o.verifiedByUserId !== undefined) out.verifiedByUserId = o.verifiedByUserId
  if (o.verifiedAt !== undefined) out.verifiedAt = FsTimestamp.fromDate(o.verifiedAt)
  return out
}

function opportunityToUpdatePayload(o: Opportunity, nextVersion: number): OpportunityUpdateWrite {
  const out: OpportunityUpdateWrite = {
    employerName: o.employerName,
    jobTitle: o.jobTitle,
    descriptionText: o.descriptionText,
    version: nextVersion,
    workMode: o.workMode ?? FieldValue.delete(),
    location: o.location ?? FieldValue.delete(),
    sourceUrl: o.sourceUrl ?? FieldValue.delete(),
  }
  return out
}

function transitionToActivityPayload(t: OpportunityTransition): OpportunityActivityWrite {
  return {
    type: 'transition',
    from: t.from,
    to: t.to,
    actorUserId: t.actorUserId,
    authorUserId: t.actorUserId,
    authorRole: 'coordinator',
    ...(t.comment !== undefined ? { comment: t.comment } : {}),
    _schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
  }
}

function verificationToActivityPayload(v: OpportunityVerification): OpportunityActivityWrite {
  return {
    type: 'verification',
    from: v.from,
    to: v.to,
    decision: v.decision,
    actorUserId: v.actorUserId,
    authorUserId: v.actorUserId,
    authorRole: 'coordinator',
    ...(v.comment !== undefined ? { comment: v.comment } : {}),
    _schemaVersion: OPPORTUNITY_SCHEMA_VERSION,
  }
}

export class FirestoreOpportunityRepository implements OpportunityRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Opportunity | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseOpportunity(snap.id, snap.data())
      },
      { op: 'opportunities.findById', resource: 'Opportunity', id }
    )
  }

  async list(filter: OpportunityListFilter): Promise<OpportunityListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(COLLECTION)

        if (filter.semesterId !== undefined) {
          q = q.where('semesterId', '==', filter.semesterId)
        }
        if (filter.status && filter.status.length > 0) {
          q =
            filter.status.length === 1
              ? q.where('status', '==', filter.status[0])
              : q.where('status', 'in', [...filter.status])
        }
        if (filter.type !== undefined) {
          q = q.where('type', '==', filter.type)
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
        const items = docs.map((doc) => parseOpportunity(doc.id, doc.data()))

        let nextCursor: OpportunityListCursor | null = null
        if (hasMore) {
          const last = docs[docs.length - 1]!
          const value = last.data()['createdAt']
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
      { op: 'opportunities.list', resource: 'Opportunity' }
    )
  }

  async countApplications(opportunityId: string): Promise<number> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection('internships')
          .where('opportunityId', '==', opportunityId)
          .get()
        return snap.size
      },
      { op: 'opportunities.countApplications', resource: 'Opportunity', id: opportunityId }
    )
  }

  async listAttachments(opportunityId: string): Promise<readonly OpportunityAttachment[]> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection(COLLECTION)
          .doc(opportunityId)
          .collection('attachments')
          .orderBy('uploadedAt', 'asc')
          .get()
        return snap.docs.map((doc) => parseAttachment(doc.id, doc.data()))
      },
      { op: 'opportunities.listAttachments', resource: 'Opportunity', id: opportunityId }
    )
  }

  async findAttachmentById(
    opportunityId: string,
    attachmentId: string
  ): Promise<OpportunityAttachment | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb
          .collection(COLLECTION)
          .doc(opportunityId)
          .collection('attachments')
          .doc(attachmentId)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseAttachment(snap.id, snap.data())
      },
      {
        op: 'opportunities.findAttachmentById',
        resource: 'Opportunity',
        id: `${opportunityId}/attachments/${attachmentId}`,
      }
    )
  }

  async saveAttachmentFromStorage(opportunityId: string, attachment: Attachment): Promise<boolean> {
    return translateFirestoreErrors(
      async () => {
        const parentRef = adminDb.collection(COLLECTION).doc(opportunityId)
        const parent = await this.txn.get(parentRef)
        if (!parent.exists) return false

        this.txn.set(
          parentRef.collection('attachments').doc(attachment.id),
          attachmentToPayload(attachment)
        )
        return true
      },
      {
        op: 'opportunities.saveAttachmentFromStorage',
        resource: 'Opportunity',
        id: opportunityId,
      }
    )
  }

  async create(opportunity: Opportunity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(opportunity.id)
        const doc: OpportunityCreateDoc = {
          ...opportunityToCreatePayload(opportunity),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'opportunities.create', resource: 'Opportunity' }
    )
  }

  async save(opportunity: Opportunity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(opportunity.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Opportunity', opportunity.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== opportunity.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const transition = opportunity.pendingTransition
        if (transition) {
          const update: OpportunityTransitionDoc = {
            status: opportunity.status,
            version: stored + 1,
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
          const activityDoc: OpportunityActivityDoc = {
            ...transitionToActivityPayload(transition),
            createdAt: FieldValue.serverTimestamp(),
          }
          this.txn.set(ref.collection('activity').doc(), activityDoc)
          return
        }

        const verification = opportunity.pendingVerification
        if (verification) {
          const update: OpportunityVerificationDoc = {
            status: opportunity.status,
            verifiedByUserId: opportunity.verifiedByUserId!,
            verifiedAt: FieldValue.serverTimestamp(),
            version: stored + 1,
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
          const activityDoc: OpportunityActivityDoc = {
            ...verificationToActivityPayload(verification),
            createdAt: FieldValue.serverTimestamp(),
          }
          this.txn.set(ref.collection('activity').doc(), activityDoc)
          return
        }

        const update: OpportunityUpdateDoc = {
          ...opportunityToUpdatePayload(opportunity, stored + 1),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)
      },
      { op: 'opportunities.save', resource: 'Opportunity', id: opportunity.id }
    )
  }
}

function parseOpportunity(id: string, raw: unknown): Opportunity {
  const parsed = opportunityStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`opportunities/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToOpportunity(id, parsed.data)
}

function parseAttachment(id: string, raw: unknown): OpportunityAttachment {
  const parsed = attachmentStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `opportunities/*/attachments/${id} storage-shape validation failed: ${parsed.error.message}`
    )
  }
  const data: AttachmentStorage = parsed.data
  const props: AttachmentProps = {
    id,
    filePath: data.filePath,
    fileName: data.fileName,
    contentType: data.contentType,
    uploadedAt: data.uploadedAt.toDate(),
  }
  return Attachment.rehydrate(props)
}

function attachmentToPayload(attachment: Attachment): AttachmentDoc {
  return {
    filePath: attachment.filePath,
    ...(attachment.fileName !== undefined ? { fileName: attachment.fileName } : {}),
    ...(attachment.contentType !== undefined ? { contentType: attachment.contentType } : {}),
    uploadedAt: FsTimestamp.fromDate(attachment.uploadedAt),
    _schemaVersion: ATTACHMENT_SCHEMA_VERSION,
  }
}
