import type { Semester } from '../../../domain/entities/semester'
import type { SemesterListFilter, SemesterListPage } from '../../read-models/semester'

/**
 * Read-side port for the `semesters` aggregate. Standalone singleton — not
 * on the UnitOfWork. The natural-key lookup is read-only and must NOT be
 * used as a check-then-create guard — uniqueness is enforced atomically
 * inside the write-side `save()` against the guard doc collection.
 *
 * Input/output models live in `application/read-models/semester`.
 */
export interface SemesterQueryService {
  findById(id: string): Promise<Semester | null>
  findByNaturalKey(semesterCode: string, courseCode: string): Promise<Semester | null>
  list(filter: SemesterListFilter): Promise<SemesterListPage>
}
