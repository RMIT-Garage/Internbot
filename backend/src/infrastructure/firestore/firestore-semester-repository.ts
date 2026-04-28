import { z } from 'zod'
import { Timestamp, type Transaction, type Query } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type {
  SemesterRepository,
  SemesterListFilter,
  SemesterListPage,
  SemesterListCursor,
} from '../../domain/repositories/semester-repository'
import { Semester, SEMESTER_SCHEMA_VERSION } from '../../domain/entities/semester'
import type { SemesterTransition } from '../../domain/value-objects/semester-transition'
import {
  semesterStatusValues,
  type SemesterStatus,
  type SemesterActivityType,
} from '../../domain/value-objects/semester-enums'
import { ConflictError, NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

// ---------- storage schema (Zod boundary at persistence/domain) ----------
//
// Domain types stay pure TS. Timestamps are Firestore `Timestamp` instances
// here; the mappers below convert to domain `Date`. `safeParse` runs on the
// read path so corrupt persisted shapes surface loudly at the boundary.

const firestoreTimestamp = z.instanceof(Timestamp)

const semesterStorageSchema = z.object({
  semesterCode: z.string().min(1),
  courseCode: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(semesterStatusValues),
  // Cleared via PATCH writes `null`; absent means "never set". Both map to
  // `undefined` on the domain side.
  enrolmentOpenAt: firestoreTimestamp.nullable().optional(),
  enrolmentCloseAt: firestoreTimestamp.nullable().optional(),
  // App-managed monotonic OCC token. Bumped on every write inside the
  // repository transaction. `.default(0)` lets legacy pre-versioning docs
  // parse cleanly; their first save promotes them to `1`.
  version: z.number().int().nonnegative().default(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

type SemesterStorage = z.infer<typeof semesterStorageSchema>

// ---------- storage ↔ domain mappers (colocated with the repo) ----------
//
// Firestore types stay confined to this file. Domain aggregates are
// constructed via `Semester.rehydrate` on the storage path (no validation —
// trust persisted data). Optional enrolment fields are persisted as
// explicit `null` on create so they participate in `orderBy(field)`
// pagination (Firestore `orderBy` skips docs where the field is missing).

function tsToDate(ts: Timestamp | null | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function mapStorageToSemester(id: string, storage: SemesterStorage): Semester {
  return Semester.rehydrate({
    id,
    version: storage.version,
    semesterCode: storage.semesterCode,
    courseCode: storage.courseCode,
    displayName: storage.displayName,
    status: storage.status,
    enrolmentOpenAt: tsToDate(storage.enrolmentOpenAt),
    enrolmentCloseAt: tsToDate(storage.enrolmentCloseAt),
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
  })
}

// ---------- write-payload types --------------------------------------
//
// Storage shape (`SemesterStorage`) describes the doc *at rest*; write
// shapes additionally allow `FieldValue` sentinels (server timestamps,
// `delete()`) on persistence-managed fields. Splitting them keeps both
// sides honest:
//   • Mappers return write shapes — the compiler verifies every field.
//   • The repo's `txn.set/update` calls splice in `serverTimestamp()` for
//     `createdAt`/`updatedAt` without weakening the type.

type SemesterCreateWrite = {
  semesterCode: string
  courseCode: string
  displayName: string
  status: SemesterStatus
  enrolmentOpenAt: Timestamp | null
  enrolmentCloseAt: Timestamp | null
  version: number
  _schemaVersion: typeof SEMESTER_SCHEMA_VERSION
}

type SemesterUpdateWrite = {
  displayName: string
  enrolmentOpenAt: Timestamp | null
  enrolmentCloseAt: Timestamp | null
  version: number
}

type SemesterActivityWrite = {
  type: SemesterActivityType
  from: SemesterStatus
  to: SemesterStatus
  actorUserId: string
  comment?: string
  _schemaVersion: typeof SEMESTER_SCHEMA_VERSION
}

// `FieldValue` covers `serverTimestamp()`, `delete()`, etc. — used wherever
// the caller composes a write doc that splices in persistence sentinels.
type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>

type SemesterCreateDoc = SemesterCreateWrite & {
  createdAt: ServerTimestamp
  updatedAt: ServerTimestamp
}
type SemesterUpdateDoc = SemesterUpdateWrite & { updatedAt: ServerTimestamp }
type SemesterTransitionDoc = {
  status: SemesterStatus
  version: number
  updatedAt: ServerTimestamp
}
type SemesterActivityDoc = SemesterActivityWrite & { createdAt: ServerTimestamp }

type SemesterNaturalKeyGuard = {
  semesterId: string
  semesterCode: string
  courseCode: string
  createdAt: ServerTimestamp
  _schemaVersion: typeof SEMESTER_SCHEMA_VERSION
}

function semesterToCreatePayload(s: Semester): SemesterCreateWrite {
  return {
    semesterCode: s.semesterCode,
    courseCode: s.courseCode,
    displayName: s.displayName,
    status: s.status,
    enrolmentOpenAt: s.enrolmentOpenAt ? FsTimestamp.fromDate(s.enrolmentOpenAt) : null,
    enrolmentCloseAt: s.enrolmentCloseAt ? FsTimestamp.fromDate(s.enrolmentCloseAt) : null,
    // Create is the first save — first persisted version is always 1.
    // The in-memory aggregate's `version: 0` is "not yet persisted"; we
    // never reuse the aggregate after `create()` (the route dispatches a
    // fresh `findById`), so the in-memory/storage skew is harmless.
    version: 1,
    _schemaVersion: SEMESTER_SCHEMA_VERSION,
  }
}

function semesterToUpdatePayload(s: Semester, nextVersion: number): SemesterUpdateWrite {
  return {
    displayName: s.displayName,
    enrolmentOpenAt: s.enrolmentOpenAt ? FsTimestamp.fromDate(s.enrolmentOpenAt) : null,
    enrolmentCloseAt: s.enrolmentCloseAt ? FsTimestamp.fromDate(s.enrolmentCloseAt) : null,
    version: nextVersion,
  }
}

function transitionToActivityPayload(t: SemesterTransition): SemesterActivityWrite {
  return {
    type: 'transition',
    from: t.from,
    to: t.to,
    actorUserId: t.actorUserId,
    ...(t.comment !== undefined ? { comment: t.comment } : {}),
    _schemaVersion: SEMESTER_SCHEMA_VERSION,
  }
}

// ---------------------------------------------------------------------

const COLLECTION = 'semesters'

/**
 * Sibling collection of natural-key guard documents — one doc per
 * `(courseCode, semesterCode)` tuple. Used to enforce the §7.5 uniqueness
 * rule **atomically** under concurrent creators.
 *
 * Why this exists: a transactional `where(...).where(...).limit(1)` query
 * does NOT lock the empty-key space — Firestore tracks the read set as the
 * documents the query *returned*, not the documents that *would* match. Two
 * concurrent transactions that both see "no match" can therefore both
 * commit different auto-id semesters with the same natural key. Reading a
 * specific (deterministic-id) document, even when absent, **does** add it
 * to the transaction's read set, so concurrent commits that try to write it
 * are mutually exclusive — exactly what we need.
 */
const NATURAL_KEY_COLLECTION = 'semesterNaturalKeys'

/**
 * Build the deterministic guard-doc id for a `(courseCode, semesterCode)`
 * tuple. Both inputs are validated at the API boundary
 * (`semesterCode = [A-Za-z0-9-]+`, `courseCode = [A-Z0-9]+`) so the `__`
 * separator never appears inside either component — the composite id is
 * collision-free and Firestore-safe.
 */
function naturalKeyDocId(semesterCode: string, courseCode: string): string {
  return `${courseCode}__${semesterCode}`
}

/**
 * Session-scoped Firestore implementation of `SemesterRepository`.
 *
 * Constructed by `FirestoreUnitOfWork.execute` with a live `Transaction`.
 * Reads + writes that participate in a transaction (uniqueness check,
 * PATCH save, transition + activity record) run inside the txn; the
 * `list` query is the only read path that does not require transaction
 * semantics — it runs against `adminDb` directly so it can paginate
 * outside Firestore's transactional read limits.
 */
export class FirestoreSemesterRepository implements SemesterRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string) {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parse(snap.id, snap.data())
      },
      { op: 'semesters.findById', resource: 'Semester', id }
    )
  }

  async findByNaturalKey(semesterCode: string, courseCode: string) {
    return translateFirestoreErrors(
      async () => {
        // Read-only resolution by the (semesterCode, courseCode) composite.
        // The composite is a uniqueness constraint enforced by the sibling
        // guard collection; the primary key is still the auto-id `semester.id`.
        //
        // Callers MUST NOT use this as a check-then-create guard outside a
        // transaction — atomic uniqueness lives inside `create()` (see the
        // doc on that method). This method exists for lookups only.
        //
        // Resolve via the guard doc, then dereference. Single direct-id read
        // on each side — works inside the txn read-set, no dependency on
        // query-result-set tracking.
        const guardRef = adminDb
          .collection(NATURAL_KEY_COLLECTION)
          .doc(naturalKeyDocId(semesterCode, courseCode))
        const guardSnap = await this.txn.get(guardRef)
        if (!guardSnap.exists) return null
        const semesterId = guardSnap.data()?.['semesterId']
        if (typeof semesterId !== 'string' || semesterId.length === 0) return null

        const ref = adminDb.collection(COLLECTION).doc(semesterId)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parse(snap.id, snap.data())
      },
      { op: 'semesters.findByNaturalKey', resource: 'Semester' }
    )
  }

  /**
   * `list` runs OUTSIDE the transaction context. Listing is a read-only
   * query that benefits from cursor-based resume; wrapping it in the
   * caller's transaction would lock-step it with potentially-unrelated
   * writes. The repo is constructed per-txn so it still honours the
   * UnitOfWork lifecycle, but the actual read uses `adminDb`.
   */
  async list(filter: SemesterListFilter): Promise<SemesterListPage> {
    return translateFirestoreErrors(
      async () => {
        let q: Query = adminDb.collection(COLLECTION)

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
        const items = docs.map((doc) => parse(doc.id, doc.data()))

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

  /**
   * Atomic insert + uniqueness check on `(semesterCode, courseCode)`.
   *
   * Reads a deterministic-id guard doc (`semesterNaturalKeys/{guardId}`)
   * inside the transaction. Whether the guard already exists or not, the
   * read pins that document into the txn's read set — concurrent creators
   * therefore commit serially and only one can write the guard. The loser
   * retries (Firestore Admin SDK auto-retries `ABORTED`), re-reads the
   * now-existing guard, and surfaces `ConflictError(natural_key_exists)`.
   *
   * On commit we write the guard + the semester doc atomically, so the
   * guard never leads to a phantom semester id.
   */
  async create(semester: Semester): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const guardRef = adminDb
          .collection(NATURAL_KEY_COLLECTION)
          .doc(naturalKeyDocId(semester.semesterCode, semester.courseCode))
        const guardSnap = await this.txn.get(guardRef)
        if (guardSnap.exists) {
          throw new ConflictError(
            `Semester with semesterCode='${semester.semesterCode}' and courseCode='${semester.courseCode}' already exists`,
            'natural_key_exists'
          )
        }

        // Aggregate carries its own id (minted up-front via nextIdentity()).
        const ref = adminDb.collection(COLLECTION).doc(semester.id)
        const payload: SemesterCreateDoc = {
          ...semesterToCreatePayload(semester),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.set(ref, payload)
        // `create` carries an `exists=false` precondition — if a concurrent
        // txn races past our read and commits the guard first, *this* commit
        // fails with `already-exists`, which the error translator maps to
        // ConflictError(natural_key_exists). Belt-and-braces with the
        // read-set lock above; the emulator's transaction isolation is
        // weaker than production, so we don't rely on the read alone.
        const guardDoc: SemesterNaturalKeyGuard = {
          semesterId: ref.id,
          semesterCode: semester.semesterCode,
          courseCode: semester.courseCode,
          createdAt: FieldValue.serverTimestamp(),
          _schemaVersion: SEMESTER_SCHEMA_VERSION,
        }
        this.txn.create(guardRef, guardDoc)
      },
      { op: 'semesters.create', resource: 'Semester', conflictReason: 'natural_key_exists' }
    )
  }

  /**
   * Persist mutations on an existing aggregate with optimistic concurrency.
   *
   * Drains `semester.pendingTransition` (set by `applyTransition`): when
   * present, writes a new doc to `semesters/{id}/activity/{auto}`
   * **atomically** with the parent status update — both writes commit
   * together or neither does. When absent, behaves as a plain PATCH save.
   *
   * Optimistic concurrency uses `semester.version` (re-read inside the
   * transaction). Throws `PreconditionFailedError` on stale version,
   * `NotFoundError` if the semester was deleted between handler load and
   * the txn read.
   */
  async save(semester: Semester): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(COLLECTION).doc(semester.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Semester', semester.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== semester.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const transition = semester.pendingTransition
        if (transition) {
          // Transition path: minimal status update + activity-record insert
          // in one txn. Skip the broader update payload — a transition only
          // moves status, never the editable PATCH fields.
          const update: SemesterTransitionDoc = {
            status: semester.status,
            version: stored + 1,
            updatedAt: FieldValue.serverTimestamp(),
          }
          this.txn.update(ref, update)
          const activityRef = ref.collection('activity').doc()
          const activityDoc: SemesterActivityDoc = {
            ...transitionToActivityPayload(transition),
            createdAt: FieldValue.serverTimestamp(),
          }
          this.txn.set(activityRef, activityDoc)
          return
        }

        const update: SemesterUpdateDoc = {
          ...semesterToUpdatePayload(semester, stored + 1),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)
      },
      { op: 'semesters.save', resource: 'Semester', id: semester.id }
    )
  }
}

function parse(id: string, raw: unknown): Semester {
  const parsed = semesterStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`semesters/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToSemester(id, parsed.data)
}
