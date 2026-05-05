import { z } from 'zod'
import {
  Timestamp,
  type Query,
  type QueryDocumentSnapshot,
  type Transaction,
} from 'firebase-admin/firestore'
import { Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type {
  ActivityFeedRepository,
  UserActivityFeedFilter,
  UserActivityFeedPage,
} from '../../application/ports/activity-feed-repository'
import type { UserActivityFeedItem } from '../../application/models/user-activity'
import { internshipActivityTypeValues } from '../../domain/value-objects/internship-enums'
import {
  opportunityActivityTypeValues,
  opportunityStatusValues,
  opportunityVerificationDecisionValues,
} from '../../domain/value-objects/opportunity-enums'
import { roleValues } from '../../domain/value-objects/user-enums'
import { translateFirestoreErrors } from './translate-firestore-errors'

const firestoreTimestamp = z.instanceof(Timestamp)

const internshipActivityStorageSchema = z.object({
  type: z.enum(internshipActivityTypeValues),
  authorUserId: z.string().min(1),
  authorRole: z.enum(roleValues),
  text: z.string().optional(),
  createdAt: firestoreTimestamp,
  _schemaVersion: z.number().int().optional(),
})

const opportunityActivityStorageSchema = z.object({
  type: z.enum(opportunityActivityTypeValues),
  from: z.enum(opportunityStatusValues),
  to: z.enum(opportunityStatusValues),
  actorUserId: z.string().min(1).optional(),
  authorUserId: z.string().min(1).optional(),
  authorRole: z.enum(roleValues).optional(),
  comment: z.string().optional(),
  decision: z.enum(opportunityVerificationDecisionValues).optional(),
  createdAt: firestoreTimestamp,
  _schemaVersion: z.number().int().optional(),
})

type InternshipActivityStorage = z.infer<typeof internshipActivityStorageSchema>
type OpportunityActivityStorage = z.infer<typeof opportunityActivityStorageSchema>

export class FirestoreActivityFeedRepository implements ActivityFeedRepository {
  constructor(private readonly txn: Transaction) {}

  async listByAuthor(filter: UserActivityFeedFilter): Promise<UserActivityFeedPage> {
    return translateFirestoreErrors(
      async () => {
        try {
          let q: Query = adminDb
            .collectionGroup('activity')
            .where('authorUserId', '==', filter.authorUserId)
            .orderBy('createdAt', filter.sortDirection)
            .orderBy('__name__', filter.sortDirection)

          if (filter.cursor) {
            q = q.startAfter(
              FsTimestamp.fromDate(filter.cursor.lastCreatedAt),
              filter.cursor.lastDocPath
            )
          }

          q = q.limit(filter.limit + 1)
          const result = await this.txn.get(q)
          const hasMore = result.size > filter.limit
          const docs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
          const items = docs.map(parseActivityDocument)

          const last = docs[docs.length - 1]
          const nextCursor =
            hasMore && last
              ? {
                  sortDirection: filter.sortDirection,
                  lastCreatedAt: timestampField(last, 'createdAt').toDate(),
                  lastDocPath: last.ref.path,
                }
              : null

          return { items, nextCursor }
        } catch (err) {
          if (isFailedPrecondition(err)) {
            throw new Error(
              'Missing Firestore composite index for collection group `activity`: declare `authorUserId ASC` + `createdAt ASC/DESC` in docker/firebase-emulator/firebase/firestore.indexes.json.',
              { cause: err }
            )
          }
          throw err
        }
      },
      { op: 'activityFeed.listByAuthor', resource: 'Activity' }
    )
  }
}

function parseActivityDocument(doc: QueryDocumentSnapshot): UserActivityFeedItem {
  const parent = doc.ref.parent.parent
  const resourceCollection = parent?.parent.id
  if (!parent || !resourceCollection) {
    throw new Error(`${doc.ref.path} has no supported activity parent`)
  }

  if (resourceCollection === 'internships') {
    return mapInternshipActivity(doc, parent.id)
  }
  if (resourceCollection === 'opportunities') {
    return mapOpportunityActivity(doc, parent.id)
  }

  throw new Error(`${doc.ref.path} activity parent '${resourceCollection}' is not feed-supported`)
}

function mapInternshipActivity(
  doc: QueryDocumentSnapshot,
  internshipId: string
): UserActivityFeedItem {
  const parsed = internshipActivityStorageSchema.safeParse(doc.data())
  if (!parsed.success) {
    throw new Error(`${doc.ref.path} storage-shape validation failed: ${parsed.error.message}`)
  }
  const data: InternshipActivityStorage = parsed.data
  return {
    id: doc.id,
    resourceType: 'internship',
    internshipId,
    opportunityId: undefined,
    type: data.type,
    authorUserId: data.authorUserId,
    authorRole: data.authorRole,
    text: data.text,
    from: undefined,
    to: undefined,
    decision: undefined,
    createdAt: data.createdAt.toDate(),
  }
}

function mapOpportunityActivity(
  doc: QueryDocumentSnapshot,
  opportunityId: string
): UserActivityFeedItem {
  const parsed = opportunityActivityStorageSchema.safeParse(doc.data())
  if (!parsed.success) {
    throw new Error(`${doc.ref.path} storage-shape validation failed: ${parsed.error.message}`)
  }
  const data: OpportunityActivityStorage = parsed.data
  const authorUserId = data.authorUserId ?? data.actorUserId
  if (!authorUserId) {
    throw new Error(`${doc.ref.path} activity has no authorUserId`)
  }
  return {
    id: doc.id,
    resourceType: 'opportunity',
    internshipId: undefined,
    opportunityId,
    type: data.type,
    authorUserId,
    authorRole: data.authorRole ?? 'coordinator',
    text: data.comment,
    from: data.from,
    to: data.to,
    decision: data.decision,
    createdAt: data.createdAt.toDate(),
  }
}

function timestampField(doc: QueryDocumentSnapshot, field: string): Timestamp {
  const value = doc.data()[field]
  if (!(value instanceof Timestamp)) {
    throw new Error(`${doc.ref.path}.${field} is not a Firestore Timestamp`)
  }
  return value
}

function isFailedPrecondition(err: unknown): boolean {
  return (
    !!err &&
    typeof err === 'object' &&
    'code' in err &&
    (err as { code?: unknown }).code === 'failed-precondition'
  )
}
