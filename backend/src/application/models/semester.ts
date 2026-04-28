import type { Semester } from '../../domain/entities/semester'

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
