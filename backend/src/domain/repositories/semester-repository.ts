import type { Semester } from '../entities/semester'
import type { SemesterStatus } from '../value-objects/semester-enums'

/**
 * Cursor (opaque to callers above the repository) for resuming a paginated
 * list query. Carried as `pageToken` at the API boundary; the API layer is
 * responsible for base64url encoding / decoding.
 */
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
 * SemesterRepository — session-scoped read/write port over the `semesters`
 * aggregate.
 *
 * Domain-layer port: implementations live in `infrastructure/firestore/` and
 * must never leak persistence types (Firestore Timestamp, snapshots, …)
 * through this interface.
 *
 * Concurrency: `save()` uses `semester.version` (an app-managed monotonic
 * integer persisted on the doc) as the optimistic-lock precondition.
 */
export interface SemesterRepository {
  findById(id: string): Promise<Semester | null>

  /**
   * Look up a semester by the `(semesterCode, courseCode)` composite. This
   * tuple is a **uniqueness constraint**, not the primary key — the primary
   * key is the auto-generated `semester.id`. The composite is enforced via
   * a sibling guard collection (see the impl).
   *
   * ⚠️  DO NOT use this as a check-then-create guard outside a transaction.
   * Reading the composite, observing "absent", and then calling `create()`
   * in a separate UnitOfWork session re-introduces the exact TOCTOU race
   * that the in-`create()` guard-doc lock was designed to prevent — two
   * concurrent callers can both see no-match and both insert. Atomic
   * uniqueness enforcement lives inside `create()` itself; use this method
   * only for read-only resolution (e.g. lookups, list-view dedupe).
   */
  findByNaturalKey(semesterCode: string, courseCode: string): Promise<Semester | null>

  list(filter: SemesterListFilter): Promise<SemesterListPage>

  /**
   * Insert a freshly-created `Semester` aggregate with **atomic** natural-key
   * uniqueness enforcement: re-runs the `(semesterCode, courseCode)` query
   * inside the transaction and rejects with `ConflictError`
   * (`reason: natural_key_exists`) on collision. The aggregate must already
   * carry a non-empty id (minted via `IdGenerator` before construction).
   */
  create(semester: Semester): Promise<void>

  /**
   * Persist mutations on an existing aggregate with optimistic concurrency.
   *
   * Drains `semester.pendingTransition` (set by `applyTransition`): when
   * present, writes a new doc to `semesters/{id}/activity/{auto}`
   * **atomically** with the parent status update — either both commit or
   * neither does. When absent, behaves as a plain PATCH save.
   *
   * `recordTransition` is therefore not a separate method — the aggregate
   * carries the audit intent and the repo treats it as one transactional
   * write.
   */
  save(semester: Semester): Promise<void>
}
