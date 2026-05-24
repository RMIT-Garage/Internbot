import type { Query } from 'firebase-admin/firestore'
import { adminDb } from '../config/firebase-admin'
import type { Opportunity } from '../../domain/entities/opportunity'
import type { OpportunityQueryService } from '../../application/ports/queries/opportunity-query-service'
import type {
  OpportunityAttachment,
  OpportunityListCursor,
  OpportunityListFilter,
  OpportunityListPage,
} from '../../application/read-models/opportunity'
import {
  OPPORTUNITY_COLLECTION,
  parseOpportunity,
  parseOpportunityAttachment,
} from './firestore-opportunity-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Firestore impl of the read-side `OpportunityQueryService`. Singleton —
 * not bound to a Firestore Transaction. `findById` here is a lightweight
 * read that does NOT eager-load the attachments subcollection (use the
 * write-side repo's `findById` from inside `uow.execute(...)` when you
 * need the full aggregate for invariant checks).
 *
 * Soft-deleted attachments are hidden from the read side.
 */
export class FirestoreOpportunityQueryService implements OpportunityQueryService {
  async findById(id: string): Promise<Opportunity | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(OPPORTUNITY_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseOpportunity(snap.id, snap.data())
      },
      { op: 'opportunities.findById', resource: 'Opportunity', id }
    )
  }

  async list(filter: OpportunityListFilter): Promise<OpportunityListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(OPPORTUNITY_COLLECTION)

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

        // When submittedByUserId is set we run a parallel query to also fetch the
        // caller's own non-published custom submissions and union them in. These are
        // typically a handful of docs so we fetch them without a cursor.
        const ownSubmissionsPromise = filter.submittedByUserId
          ? adminDb
              .collection(OPPORTUNITY_COLLECTION)
              .where('submittedByUserId', '==', filter.submittedByUserId)
              .where('type', '==', 'custom')
              .where('status', 'in', ['draft', 'pending_verification', 'rejected', 'archived'])
              .get()
          : Promise.resolve(null)

        q = q.limit(filter.limit + 1)
        const [result, ownSnap] = await Promise.all([q.get(), ownSubmissionsPromise])

        const hasMore = result.size > filter.limit
        const primaryDocs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
        const primaryItems = primaryDocs.map((doc) => parseOpportunity(doc.id, doc.data()))

        let items = primaryItems
        if (ownSnap && ownSnap.size > 0) {
          const primaryIds = new Set(primaryItems.map((o) => o.id))
          const ownItems = ownSnap.docs
            .filter((doc) => !primaryIds.has(doc.id))
            .map((doc) => parseOpportunity(doc.id, doc.data()))
          // Merge and sort by createdAt descending (own submissions go to the end)
          const merged = [...primaryItems, ...ownItems]
          merged.sort((a, b) => {
            const diff = b.createdAt.getTime() - a.createdAt.getTime()
            if (diff !== 0) return diff
            return b.id < a.id ? -1 : 1
          })
          items = merged
        }

        let nextCursor: OpportunityListCursor | null = null
        if (hasMore) {
          const last = primaryDocs[primaryDocs.length - 1]!
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
          .collection(OPPORTUNITY_COLLECTION)
          .doc(opportunityId)
          .collection('attachments')
          .orderBy('uploadedAt', 'asc')
          .get()
        return snap.docs.map((doc) => parseOpportunityAttachment(doc.id, doc.data()))
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
        const snap = await adminDb
          .collection(OPPORTUNITY_COLLECTION)
          .doc(opportunityId)
          .collection('attachments')
          .doc(attachmentId)
          .get()
        if (!snap.exists) return null
        return parseOpportunityAttachment(snap.id, snap.data())
      },
      {
        op: 'opportunities.findAttachmentById',
        resource: 'Opportunity',
        id: `${opportunityId}/attachments/${attachmentId}`,
      }
    )
  }
}

/** Production singleton. */
export const firestoreOpportunityQueryService: OpportunityQueryService =
  new FirestoreOpportunityQueryService()
