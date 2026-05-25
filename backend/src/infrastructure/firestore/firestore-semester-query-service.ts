import type { Query } from 'firebase-admin/firestore'
import { adminDb } from '../config/firebase-admin'
import type { Semester } from '../../domain/entities/semester'
import type {
  SemesterQueryService,
  SemesterKPIs,
} from '../../application/ports/queries/semester-query-service'
import type {
  SemesterListCursor,
  SemesterListFilter,
  SemesterListPage,
} from '../../application/read-models/semester'
import {
  SEMESTER_COLLECTION,
  SEMESTER_NATURAL_KEY_COLLECTION,
  parseSemester,
  semesterNaturalKeyDocId,
} from './firestore-semester-repository'
import { INTERNSHIP_COLLECTION } from './firestore-internship-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

const USER_COLLECTION = 'users'

/**
 * Firestore impl of the read-side `SemesterQueryService`. Singleton — not
 * bound to a Firestore Transaction.
 *
 * The natural-key lookup is read-only and must NOT be used as a
 * check-then-create guard outside a transaction — atomic uniqueness lives
 * inside `FirestoreSemesterRepository.save()`.
 */
export class FirestoreSemesterQueryService implements SemesterQueryService {
  async findById(id: string): Promise<Semester | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(SEMESTER_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseSemester(snap.id, snap.data())
      },
      { op: 'semesters.findById', resource: 'Semester', id }
    )
  }

  async findByNaturalKey(semesterCode: string, courseCode: string): Promise<Semester | null> {
    return translateFirestoreErrors(
      async () => {
        const guardRef = adminDb
          .collection(SEMESTER_NATURAL_KEY_COLLECTION)
          .doc(semesterNaturalKeyDocId(semesterCode, courseCode))
        const guardSnap = await guardRef.get()
        if (!guardSnap.exists) return null
        const semesterId = guardSnap.data()?.['semesterId']
        if (typeof semesterId !== 'string' || semesterId.length === 0) return null

        const snap = await adminDb.collection(SEMESTER_COLLECTION).doc(semesterId).get()
        if (!snap.exists) return null
        return parseSemester(snap.id, snap.data())
      },
      { op: 'semesters.findByNaturalKey', resource: 'Semester' }
    )
  }

  async list(filter: SemesterListFilter): Promise<SemesterListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(SEMESTER_COLLECTION)

        if (filter.status && filter.status.length > 0) {
          q = q.where('status', 'in', [...filter.status])
        }
        if (filter.semesterCode !== undefined) {
          q = q.where('semesterCode', '==', filter.semesterCode)
        }
        if (filter.courseCode !== undefined) {
          q = q.where('courseCode', '==', filter.courseCode)
        }

        // Stable order: primary sort field, tie-break on document id.
        q = q
          .orderBy(filter.sortField, filter.sortDirection)
          .orderBy('__name__', filter.sortDirection)

        if (filter.cursor) {
          const lastValueTs = filter.cursor.lastValue
          // The sort field can be missing (`enrolmentOpenAt` is optional);
          // if so, `null` is used as the cursor placeholder so resume still
          // works deterministically against the secondary `__name__` order.
          q = q.startAfter(lastValueTs ?? null, filter.cursor.lastDocId)
        }

        q = q.limit(filter.limit + 1)

        const result = await q.get()
        const hasMore = result.size > filter.limit
        const docs = hasMore ? result.docs.slice(0, filter.limit) : result.docs
        const items = docs.map((doc) => parseSemester(doc.id, doc.data()))

        let nextCursor: SemesterListCursor | null = null
        if (hasMore) {
          const last = docs[docs.length - 1]!
          const value =
            filter.sortField === 'createdAt'
              ? last.data()['createdAt']
              : last.data()['enrolmentOpenAt']
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
      { op: 'semesters.list', resource: 'Semester' }
    )
  }

  async getKPIs(semesterId: string): Promise<SemesterKPIs> {
    const [enrolledSnap, openOfferSnap] = await Promise.all([
      adminDb
        .collection(USER_COLLECTION)
        .where('role', '==', 'student')
        .where('studentProfile.semesterId', '==', semesterId)
        .count()
        .get(),
      adminDb
        .collection(INTERNSHIP_COLLECTION)
        .where('semesterId', '==', semesterId)
        .where('status', 'in', ['offer_pending_review', 'offer_changes_requested'])
        .count()
        .get(),
    ])
    return {
      enrolledStudentCount: enrolledSnap.data().count,
      openOfferCount: openOfferSnap.data().count,
    }
  }

  async getKPIsForList(semesterIds: string[]): Promise<Map<string, SemesterKPIs>> {
    if (semesterIds.length === 0) return new Map()
    const results = await Promise.all(semesterIds.map((id) => this.getKPIs(id)))
    return new Map(semesterIds.map((id, i) => [id, results[i]!]))
  }
}

/** Production singleton. */
export const firestoreSemesterQueryService: SemesterQueryService =
  new FirestoreSemesterQueryService()
