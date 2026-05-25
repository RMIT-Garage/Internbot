import { adminDb } from '../config/firebase-admin'
import type { SemesterStudentQueryService } from '../../application/ports/queries/semester-student-query-service'
import type {
  SemesterStudentItem,
  SemesterStudentListFilter,
  SemesterStudentListPage,
  SemesterStudentPlacementStatus,
} from '../../application/ports/queries/semester-student-query-service'
import { USER_COLLECTION, parseUser } from './firestore-user-repository'
import { INTERNSHIP_COLLECTION } from './firestore-internship-repository'
import type { InternshipStatus } from '../../domain/value-objects/internship-enums'
import { translateFirestoreErrors } from './translate-firestore-errors'

interface CursorPayload {
  lastSelectedAt: string | null
  lastDocId: string
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64url')
}

function decodeCursor(token: string): CursorPayload | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(token, 'base64url').toString('utf-8'))
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !('lastDocId' in parsed) ||
      typeof (parsed as Record<string, unknown>)['lastDocId'] !== 'string'
    ) {
      return null
    }
    const p = parsed as Record<string, unknown>
    return {
      lastSelectedAt: typeof p['lastSelectedAt'] === 'string' ? p['lastSelectedAt'] : null,
      lastDocId: p['lastDocId'] as string,
    }
  } catch {
    return null
  }
}

function derivePlacementStatus(statuses: InternshipStatus[]): SemesterStudentPlacementStatus {
  if (statuses.length === 0) return 'no_applications'
  if (statuses.includes('offer_approved')) return 'offer_approved'
  if (statuses.includes('offer_pending_review')) return 'offer_in_review'
  if (statuses.includes('offer_changes_requested')) return 'offer_changes_requested'
  if (statuses.every((s) => s === 'rejected' || s === 'withdrawn')) return 'all_rejected'
  return 'browsing'
}

export class FirestoreSemesterStudentQueryService implements SemesterStudentQueryService {
  async listBySemesterId(filter: SemesterStudentListFilter): Promise<SemesterStudentListPage> {
    return translateFirestoreErrors(
      async () => {
        // Build base user query: students enrolled in this semester.
        const baseUserQuery = adminDb
          .collection(USER_COLLECTION)
          .where('role', '==', 'student')
          .where('studentProfile.semesterId', '==', filter.semesterId)

        // Count total (unfiltered by programCode/placementStatus — counts all enrolled).
        const countSnap = await baseUserQuery.count().get()
        const totalCount = countSnap.data().count

        // Paginated user query ordered by enrollment date (most recent first).
        let userQuery = baseUserQuery
          .orderBy('studentProfile.semesterSelectedAt', 'desc')
          .orderBy('__name__', 'desc')

        // Apply cursor.
        if (filter.cursor) {
          const cursor = decodeCursor(filter.cursor)
          if (cursor) {
            const lastSelectedAt = cursor.lastSelectedAt ? new Date(cursor.lastSelectedAt) : null
            userQuery = userQuery.startAfter(lastSelectedAt, cursor.lastDocId)
          }
        }

        // Fetch one extra to detect if there's a next page. Fetch more to
        // account for post-filter drop-out when programCode is set.
        const fetchLimit = filter.limit + 1
        const [userSnap, internshipSnap] = await Promise.all([
          userQuery.limit(fetchLimit * 4).get(),
          adminDb
            .collection(INTERNSHIP_COLLECTION)
            .where('semesterId', '==', filter.semesterId)
            .get(),
        ])

        // Group internship statuses by userId.
        const internshipsByUserId = new Map<string, InternshipStatus[]>()
        for (const doc of internshipSnap.docs) {
          const data = doc.data()
          const userId = data['userId'] as string | undefined
          const status = data['status'] as InternshipStatus | undefined
          if (!userId || !status) continue
          const existing = internshipsByUserId.get(userId)
          if (existing) {
            existing.push(status)
          } else {
            internshipsByUserId.set(userId, [status])
          }
        }

        // Parse users and derive placement status, applying post-filters.
        const allItems: SemesterStudentItem[] = []
        for (const doc of userSnap.docs) {
          const user = parseUser(doc.id, doc.data())
          const profile = user.studentProfile

          // programCode filter (Firestore doesn't support this as a WHERE
          // without an index; apply in-memory instead).
          if (filter.programCode !== undefined && profile?.programCode !== filter.programCode) {
            continue
          }

          const statuses = internshipsByUserId.get(user.id) ?? []
          const placementStatus = derivePlacementStatus(statuses)

          if (filter.placementStatus !== undefined && placementStatus !== filter.placementStatus) {
            continue
          }

          allItems.push({
            userId: user.id,
            displayName: user.displayName,
            studentNumber: profile?.studentNumber,
            programCode: profile?.programCode,
            semesterSelectedAt: profile?.semesterSelectedAt,
            placementStatus,
            internshipCount: statuses.length,
          })
        }

        // Apply pagination on the filtered list.
        const hasMore = allItems.length > filter.limit
        const items = hasMore ? allItems.slice(0, filter.limit) : allItems

        let nextCursor: string | null = null
        if (hasMore && items.length > 0) {
          const last = items[items.length - 1]!
          nextCursor = encodeCursor({
            lastSelectedAt: last.semesterSelectedAt?.toISOString() ?? null,
            lastDocId: last.userId,
          })
        }

        return { items, nextCursor, totalCount }
      },
      { op: 'semesterStudents.listBySemesterId', resource: 'SemesterStudent' }
    )
  }
}

export const firestoreSemesterStudentQueryService: SemesterStudentQueryService =
  new FirestoreSemesterStudentQueryService()
