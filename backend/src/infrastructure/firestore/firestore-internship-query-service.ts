import type { Query } from 'firebase-admin/firestore'
import { adminDb } from '../config/firebase-admin'
import type { Internship } from '../../domain/entities/internship'
import type { Attachment } from '../../domain/value-objects/attachment'
import type { InternshipQueryService } from '../../application/ports/queries/internship-query-service'
import type {
  InternshipListCursor,
  InternshipListFilter,
  InternshipListPage,
} from '../../application/read-models/internship'
import {
  INTERNSHIP_COLLECTION,
  parseInternship,
  parseInternshipAttachment,
} from './firestore-internship-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Firestore impl of the read-side `InternshipQueryService`. Singleton —
 * not bound to a Firestore Transaction, so list traffic does not pay the
 * per-read transactional overhead. `findById` here is a lightweight read
 * that does NOT eager-load the attachments subcollection (use the write-
 * side repo's `findById` from inside `uow.execute(...)` when you need the
 * full aggregate for invariant checks).
 *
 * Soft-deleted attachments are hidden from the read side.
 */
export class FirestoreInternshipQueryService implements InternshipQueryService {
  async findById(id: string): Promise<Internship | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(INTERNSHIP_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseInternship(snap.id, snap.data())
      },
      { op: 'internships.findById', resource: 'Internship', id }
    )
  }

  async list(filter: InternshipListFilter): Promise<InternshipListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(INTERNSHIP_COLLECTION)

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
        const snap = await adminDb
          .collection(INTERNSHIP_COLLECTION)
          .where('userId', '==', userId)
          .get()
        return snap.docs.map((doc) => parseInternship(doc.id, doc.data()))
      },
      { op: 'internships.listByUserId', resource: 'Internship' }
    )
  }

  async listAttachments(internshipId: string): Promise<readonly Attachment[]> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection(INTERNSHIP_COLLECTION)
          .doc(internshipId)
          .collection('attachments')
          .orderBy('uploadedAt', 'asc')
          .get()
        return snap.docs
          .map((doc) => parseInternshipAttachment(doc.id, doc.data()))
          .filter((a) => !a.isDeleted)
      },
      { op: 'internships.listAttachments', resource: 'Internship', id: internshipId }
    )
  }

  async findAttachmentById(internshipId: string, attachmentId: string): Promise<Attachment | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb
          .collection(INTERNSHIP_COLLECTION)
          .doc(internshipId)
          .collection('attachments')
          .doc(attachmentId)
          .get()
        if (!snap.exists) return null
        const attachment = parseInternshipAttachment(snap.id, snap.data())
        return attachment.isDeleted ? null : attachment
      },
      {
        op: 'internships.findAttachmentById',
        resource: 'Internship',
        id: `${internshipId}/attachments/${attachmentId}`,
      }
    )
  }
}

/** Production singleton. */
export const firestoreInternshipQueryService: InternshipQueryService =
  new FirestoreInternshipQueryService()
