import type { Semester } from '../../domain/entities/semester'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'

export interface SemesterListCursor {
  readonly sortField: 'createdAt' | 'enrolmentOpenAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly lastValue: Date | null
  readonly lastDocId: string
}

export interface SemesterListFilter {
  readonly status: readonly SemesterStatus[] | undefined
  readonly semesterCode: string | undefined
  readonly courseCode: string | undefined
  readonly limit: number
  readonly sortField: 'createdAt' | 'enrolmentOpenAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly cursor: SemesterListCursor | undefined
}

export interface SemesterListPage {
  readonly items: readonly Semester[]
  readonly nextCursor: SemesterListCursor | null
}

/**
 * Application-layer DTOs for semester reads.
 *
 * `SemesterResult` wraps the aggregate (whose `version` carries the
 * concurrency token); the api mapper formats it as wire shape (ISO
 * timestamps, ETag derived from `version`).
 */
export interface SemesterResult {
  semester: Semester
}

export interface SemesterListResult {
  items: readonly Semester[]
  nextPageToken: string | null
}
