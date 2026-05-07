import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { OpportunityRepository } from '../../domain/repositories/opportunity-repository'
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

export const opportunityStorageSchema = z.object({
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

export const opportunityAttachmentStorageSchema = z.object({
  filePath: z.string().min(1),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  uploadedAt: firestoreTimestamp,
  storageGeneration: z.string().optional(),
  deletedAt: firestoreTimestamp.optional(),
  deletedByUserId: z.string().optional(),
  _schemaVersion: z.number().int().optional(),
})

type OpportunityStorage = z.infer<typeof opportunityStorageSchema>
type AttachmentStorage = z.infer<typeof opportunityAttachmentStorageSchema>

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
  storageGeneration?: string
  _schemaVersion: typeof ATTACHMENT_SCHEMA_VERSION
}
type AttachmentDoc = AttachmentWrite & { uploadedAt: Timestamp | ServerTimestamp }
type AttachmentSoftDeleteUpdate = {
  deletedAt: Timestamp
  deletedByUserId: string
}

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

export const OPPORTUNITY_COLLECTION = 'opportunities'

function tsToDate(ts: Timestamp | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function mapStorageToOpportunity(
  id: string,
  storage: OpportunityStorage,
  attachments: readonly Attachment[]
): Opportunity {
  return Opportunity.rehydrate(
    {
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
    },
    attachments
  )
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

export class FirestoreOpportunityRepository implements OpportunityRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Opportunity | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(OPPORTUNITY_COLLECTION).doc(id)
        const [parentSnap, attachmentSnap] = await Promise.all([
          this.txn.get(ref),
          this.txn.get(ref.collection('attachments').orderBy('uploadedAt', 'asc')),
        ])
        if (!parentSnap.exists) return null
        const attachments = attachmentSnap.docs.map((doc) =>
          parseOpportunityAttachment(doc.id, doc.data())
        )
        return parseOpportunity(parentSnap.id, parentSnap.data(), attachments)
      },
      { op: 'opportunities.findById', resource: 'Opportunity', id }
    )
  }

  /** Upsert. `version === 0` → first-write; else optimistic-lock update. */
  async save(opportunity: Opportunity): Promise<void> {
    if (opportunity.version === 0) {
      await this.insertNew(opportunity)
      return
    }
    await this.updateExisting(opportunity)
  }

  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(OPPORTUNITY_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Opportunity', id)
        this.txn.delete(ref)
      },
      { op: 'opportunities.delete', resource: 'Opportunity', id }
    )
  }

  private async insertNew(opportunity: Opportunity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(OPPORTUNITY_COLLECTION).doc(opportunity.id)
        const doc: OpportunityCreateDoc = {
          ...opportunityToCreatePayload(opportunity),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.create(ref, doc)
      },
      { op: 'opportunities.save', resource: 'Opportunity', id: opportunity.id }
    )
  }

  private async updateExisting(opportunity: Opportunity): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(OPPORTUNITY_COLLECTION).doc(opportunity.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Opportunity', opportunity.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== opportunity.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const writeAttachmentMutations = (): void => {
          for (const added of opportunity.pendingAttachmentAdds) {
            this.txn.set(ref.collection('attachments').doc(added.id), attachmentToPayload(added))
          }
          for (const tombstone of opportunity.pendingAttachmentSoftDeletes) {
            this.txn.update(ref.collection('attachments').doc(tombstone.attachmentId), {
              deletedAt: FsTimestamp.fromDate(tombstone.deletedAt),
              deletedByUserId: tombstone.deletedByUserId,
            } satisfies AttachmentSoftDeleteUpdate)
          }
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
          writeAttachmentMutations()
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
          writeAttachmentMutations()
          return
        }

        const update: OpportunityUpdateDoc = {
          ...opportunityToUpdatePayload(opportunity, stored + 1),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)
        writeAttachmentMutations()
      },
      { op: 'opportunities.save', resource: 'Opportunity', id: opportunity.id }
    )
  }
}

export function parseOpportunity(
  id: string,
  raw: unknown,
  attachments: readonly Attachment[] = []
): Opportunity {
  const parsed = opportunityStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`opportunities/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToOpportunity(id, parsed.data, attachments)
}

export function parseOpportunityAttachment(id: string, raw: unknown): Attachment {
  const parsed = opportunityAttachmentStorageSchema.safeParse(raw)
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
    storageGeneration: data.storageGeneration,
    deletedAt: data.deletedAt ? data.deletedAt.toDate() : undefined,
    deletedByUserId: data.deletedByUserId,
  }
  return Attachment.rehydrate(props)
}
