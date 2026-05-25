import { clampLimit } from '../utils/pagination'
import type { SemesterStudentPlacementStatus } from '../../application/ports/queries/semester-student-query-service'
import type { SemesterStudentListPage } from '../../application/ports/queries/semester-student-query-service'
import type { SemesterStudentListResponse } from '../dto/semester-student'
import { semesterStudentPlacementStatusValues } from '../dto/semester-student'

export interface ListSemesterStudentsQueryParams {
  placementStatus?: SemesterStudentPlacementStatus
  programCode?: string
  limit: number
  cursor?: string
}

export function parseListSemesterStudentsQuery(
  query: Record<string, unknown>,
  defaultLimit: number
): ListSemesterStudentsQueryParams {
  const limit = clampLimit(query['limit'] ?? defaultLimit)

  const rawStatus = query['placementStatus']
  const placementStatus: SemesterStudentPlacementStatus | undefined =
    typeof rawStatus === 'string' &&
    (semesterStudentPlacementStatusValues as readonly string[]).includes(rawStatus)
      ? (rawStatus as SemesterStudentPlacementStatus)
      : undefined

  const rawProgram = query['programCode']
  const programCode =
    typeof rawProgram === 'string' && rawProgram.length > 0 ? rawProgram : undefined

  const rawCursor = query['pageToken']
  const cursor = typeof rawCursor === 'string' && rawCursor.length > 0 ? rawCursor : undefined

  return { placementStatus, programCode, limit, cursor }
}

export function toSemesterStudentListResponse(
  page: SemesterStudentListPage
): SemesterStudentListResponse {
  return {
    items: page.items.map((item) => ({
      userId: item.userId,
      displayName: item.displayName ?? null,
      studentNumber: item.studentNumber ?? null,
      programCode: item.programCode ?? null,
      semesterSelectedAt: item.semesterSelectedAt?.toISOString() ?? null,
      placementStatus: item.placementStatus,
      internshipCount: item.internshipCount,
    })),
    nextPageToken: page.nextCursor,
    totalCount: page.totalCount,
  }
}
