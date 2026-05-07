import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { SemesterRepository } from '../../domain/repositories/semester-repository'
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

const firestoreTimestamp = z.instanceof(Timestamp)

export const semesterStorageSchema = z.object({
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
    // First persisted version is always 1.
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

export const SEMESTER_COLLECTION = 'semesters'

/**
 * Sibling collection of natural-key guard documents — one doc per
 * `(courseCode, semesterCode)` tuple. Used to enforce the §7.5 uniqueness
 * rule **atomically** under concurrent creators.
 */
export const SEMESTER_NATURAL_KEY_COLLECTION = 'semesterNaturalKeys'

export function semesterNaturalKeyDocId(semesterCode: string, courseCode: string): string {
  return `${courseCode}__${semesterCode}`
}

/**
 * Session-scoped Firestore implementation of `SemesterRepository`. Pure
 * DDD/CQRS write surface — `findById`, `save` (upsert), `delete`. List/
 * natural-key reads live on `SemesterQueryService`.
 *
 * Constructed by `FirestoreUnitOfWork.execute` with a live `Transaction`.
 */
export class FirestoreSemesterRepository implements SemesterRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<Semester | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(SEMESTER_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseSemester(snap.id, snap.data())
      },
      { op: 'semesters.findById', resource: 'Semester', id }
    )
  }

  /** Upsert. `version === 0` → first-write; else optimistic-lock update. */
  async save(semester: Semester): Promise<void> {
    if (semester.version === 0) {
      await this.insertNew(semester)
      return
    }
    await this.updateExisting(semester)
  }

  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(SEMESTER_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Semester', id)
        const data = snap.data()
        const semesterCode = data?.['semesterCode'] as string | undefined
        const courseCode = data?.['courseCode'] as string | undefined
        if (semesterCode && courseCode) {
          const guardRef = adminDb
            .collection(SEMESTER_NATURAL_KEY_COLLECTION)
            .doc(semesterNaturalKeyDocId(semesterCode, courseCode))
          this.txn.delete(guardRef)
        }
        this.txn.delete(ref)
      },
      { op: 'semesters.delete', resource: 'Semester', id }
    )
  }

  /**
   * Atomic insert + uniqueness check on `(semesterCode, courseCode)`.
   *
   * Reads a deterministic-id guard doc (`semesterNaturalKeys/{guardId}`)
   * inside the transaction. Whether the guard already exists or not, the
   * read pins that document into the txn's read set — concurrent creators
   * therefore commit serially and only one can write the guard.
   */
  private async insertNew(semester: Semester): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const guardRef = adminDb
          .collection(SEMESTER_NATURAL_KEY_COLLECTION)
          .doc(semesterNaturalKeyDocId(semester.semesterCode, semester.courseCode))
        const guardSnap = await this.txn.get(guardRef)
        if (guardSnap.exists) {
          throw new ConflictError(
            `Semester with semesterCode='${semester.semesterCode}' and courseCode='${semester.courseCode}' already exists`,
            'natural_key_exists'
          )
        }

        const ref = adminDb.collection(SEMESTER_COLLECTION).doc(semester.id)
        const payload: SemesterCreateDoc = {
          ...semesterToCreatePayload(semester),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.set(ref, payload)
        const guardDoc: SemesterNaturalKeyGuard = {
          semesterId: ref.id,
          semesterCode: semester.semesterCode,
          courseCode: semester.courseCode,
          createdAt: FieldValue.serverTimestamp(),
          _schemaVersion: SEMESTER_SCHEMA_VERSION,
        }
        this.txn.create(guardRef, guardDoc)
      },
      { op: 'semesters.save', resource: 'Semester', conflictReason: 'natural_key_exists' }
    )
  }

  /**
   * Persist mutations on an existing aggregate with optimistic concurrency.
   *
   * Drains `semester.pendingTransition` (set by `applyTransition`): when
   * present, writes a new doc to `semesters/{id}/activity/{auto}`
   * **atomically** with the parent status update. When absent, behaves as
   * a plain PATCH save.
   */
  private async updateExisting(semester: Semester): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(SEMESTER_COLLECTION).doc(semester.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('Semester', semester.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== semester.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const transition = semester.pendingTransition
        if (transition) {
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

export function parseSemester(id: string, raw: unknown): Semester {
  const parsed = semesterStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`semesters/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToSemester(id, parsed.data)
}
