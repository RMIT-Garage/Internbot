import type { Semester } from '../entities/semester'

/**
 * Write-side port over the `semesters` aggregate. Pure-DDD/CQRS surface —
 * exactly three methods (`findById`, `save`, `delete`).
 *
 * `save` is an upsert with **atomic** natural-key uniqueness enforcement
 * on the first-write path (`aggregate.version === 0` → re-runs the
 * `(semesterCode, courseCode)` check inside the transaction and rejects
 * with `ConflictError`/`reason: natural_key_exists` on collision). Update
 * path (`version > 0`) drains `pendingEvents` so each emitted event's
 * persistence (e.g. activity row for `SemesterTransitioned`) commits in
 * the same transaction as the parent doc update.
 *
 * Read-side `list` and `findByNaturalKey` live on `SemesterQueryService`.
 */
export interface SemesterRepository {
  findById(id: string): Promise<Semester | null>
  save(semester: Semester): Promise<void>
  delete(id: string): Promise<void>
}
