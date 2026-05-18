import { z } from 'zod'
import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { FieldValue, Timestamp as FsTimestamp, adminDb } from '../config/firebase-admin'
import type { UserRepository } from '../../domain/repositories/user-repository'
import type { IdentityProvider, UserIdentityLookup } from '../../domain/value-objects/user-identity'
import { User, USER_SCHEMA_VERSION } from '../../domain/entities/user'
import { UserIdentity } from '../../domain/value-objects/user-identity'
import { StudentProfile } from '../../domain/value-objects/student-profile'
import { AcademicInfo } from '../../domain/value-objects/academic-info'
import {
  onboardingStageValues,
  profileStatusValues,
  programLevelValues,
  programStatusValues,
  roleValues,
  studyLoadValues,
  userStatusValues,
  type Role,
  type UserStatus,
  type OnboardingStage,
  type ProfileStatus,
  type ProgramLevel,
  type ProgramStatus,
  type StudyLoad,
} from '../../domain/value-objects/user-enums'
import { NotFoundError, PreconditionFailedError } from '../../domain/errors'
import { translateFirestoreErrors } from './translate-firestore-errors'

// ---------- storage schema (Zod boundary at persistence/domain) ----------
//
// Domain types stay pure TS. Timestamps are Firestore `Timestamp` instances
// here; the mappers below convert to domain `Date`. `safeParse` runs on the
// read path so corrupt persisted shapes surface loudly at the boundary.

const firestoreTimestamp = z.instanceof(Timestamp)

const academicInfoStorageSchema = z.object({
  programName: z.string().min(1),
  programLevel: z.enum(programLevelValues),
  programStatus: z.enum(programStatusValues).optional(),
  majors: z.array(z.string()).optional(),
  minors: z.array(z.string()).optional(),
  unitsAttempted: z.number().nonnegative(),
  creditUnitsEarned: z.number().nonnegative(),
  gpa: z.number().min(0).max(4),
  currentStudyLoad: z.enum(studyLoadValues),
  notes: z.string().optional(),
  confirmedAt: firestoreTimestamp.optional(),
})

const studentProfileStorageSchema = z.object({
  studentNumber: z.string().min(1),
  programCode: z.string().optional(),
  phone: z.string().optional(),
  academicInfo: academicInfoStorageSchema.optional(),
  semesterId: z.string().optional(),
  semesterSelectedAt: firestoreTimestamp.optional(),
  profileStatus: z.enum(profileStatusValues),
})

const identityProviderSchema = z.enum(['firebase'] satisfies [IdentityProvider])

// Identity is denormalised onto the user doc — read once, no JOIN. The
// `userIdentities/{key}` sentinel still exists but only stores `{ userId }`
// for the uniqueness lock; the data here is the source of truth.
const userIdentityStorageSchema = z.object({
  provider: identityProviderSchema,
  providerUserId: z.string().min(1),
  emailSnapshot: z.string().email().optional(),
})

export const userStorageSchema = z.object({
  email: z.string().email(),
  displayName: z.string().optional(),
  role: z.enum(roleValues),
  status: z.enum(userStatusValues),
  onboardingStage: z.enum(onboardingStageValues),
  identity: userIdentityStorageSchema,
  studentProfile: studentProfileStorageSchema.optional(),
  // App-managed monotonic OCC token. Bumped on every write inside the
  // repository transaction. `.default(0)` lets legacy pre-versioning docs
  // parse cleanly; their first save promotes them to `1`.
  version: z.number().int().nonnegative().default(0),
  createdAt: firestoreTimestamp,
  updatedAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

// Slim sentinel — only carries the back-pointer to the user. Identity data
// lives on `users/{id}.identity` (denormalised). The sentinel exists purely
// as the uniqueness lock: `txn.create(sentinelRef, ...)` with `exists=false`
// fails with `already-exists` if a concurrent register raced past us.
const userIdentitySentinelSchema = z.object({
  userId: z.string().min(1),
  createdAt: firestoreTimestamp,
  _schemaVersion: z.literal(1),
})

type UserStorage = z.infer<typeof userStorageSchema>

// ---------- write-shape types (typed Firestore payloads) ----------
//
// Distinct from the storage schema (read shape) because writes mix in
// `FieldValue.serverTimestamp()` sentinels and the update payload is a
// partial of the storage shape (identity fields stay put on save).

type ServerTimestamp = ReturnType<typeof FieldValue.serverTimestamp>

type AcademicInfoWrite = {
  programName: string
  programLevel: ProgramLevel
  unitsAttempted: number
  creditUnitsEarned: number
  gpa: number
  currentStudyLoad: StudyLoad
  programStatus?: ProgramStatus
  majors?: readonly string[]
  minors?: readonly string[]
  notes?: string
  confirmedAt?: Timestamp
}

type StudentProfileWrite = {
  studentNumber: string
  profileStatus: ProfileStatus
  programCode?: string
  phone?: string
  academicInfo?: AcademicInfoWrite
  semesterId?: string
  semesterSelectedAt?: Timestamp
}

type UserIdentityWrite = {
  provider: IdentityProvider
  providerUserId: string
  emailSnapshot?: string
}

type UserCreateWrite = {
  email: string
  role: Role
  status: UserStatus
  onboardingStage: OnboardingStage
  identity: UserIdentityWrite
  displayName?: string
  studentProfile?: StudentProfileWrite
  version: number
  _schemaVersion: typeof USER_SCHEMA_VERSION
}

type UserUpdateWrite = {
  status: UserStatus
  onboardingStage: OnboardingStage
  displayName?: string
  studentProfile?: StudentProfileWrite
  version: number
}

type UserCreateDoc = UserCreateWrite & { createdAt: ServerTimestamp; updatedAt: ServerTimestamp }
type UserUpdateDoc = UserUpdateWrite & { updatedAt: ServerTimestamp }
type UserIdentitySentinelDoc = {
  userId: string
  createdAt: ServerTimestamp
  _schemaVersion: typeof USER_SCHEMA_VERSION
}

// ---------- storage ↔ domain mappers (colocated with the repo) ----------

function tsToDate(ts: Timestamp | undefined): Date | undefined {
  return ts ? ts.toDate() : undefined
}

function mapAcademicInfo(
  a: NonNullable<NonNullable<UserStorage['studentProfile']>['academicInfo']>
): AcademicInfo {
  return AcademicInfo.rehydrate({
    programName: a.programName,
    programLevel: a.programLevel,
    unitsAttempted: a.unitsAttempted,
    creditUnitsEarned: a.creditUnitsEarned,
    gpa: a.gpa,
    currentStudyLoad: a.currentStudyLoad,
    programStatus: a.programStatus,
    majors: a.majors,
    minors: a.minors,
    notes: a.notes,
    confirmedAt: tsToDate(a.confirmedAt),
  })
}

function mapStudentProfile(p: NonNullable<UserStorage['studentProfile']>): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: p.studentNumber,
    profileStatus: p.profileStatus,
    programCode: p.programCode,
    phone: p.phone,
    academicInfo: p.academicInfo ? mapAcademicInfo(p.academicInfo) : undefined,
    semesterId: p.semesterId,
    semesterSelectedAt: tsToDate(p.semesterSelectedAt),
  })
}

function mapStorageToUser(id: string, storage: UserStorage): User {
  return User.rehydrate({
    id,
    version: storage.version,
    email: storage.email,
    role: storage.role,
    status: storage.status,
    onboardingStage: storage.onboardingStage,
    identity: UserIdentity.rehydrate({
      provider: storage.identity.provider,
      providerUserId: storage.identity.providerUserId,
      emailSnapshot: storage.identity.emailSnapshot,
    }),
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
    displayName: storage.displayName,
    studentProfile: storage.studentProfile ? mapStudentProfile(storage.studentProfile) : undefined,
  })
}

function academicInfoToStorage(a: AcademicInfo): AcademicInfoWrite {
  const out: AcademicInfoWrite = {
    programName: a.programName,
    programLevel: a.programLevel,
    unitsAttempted: a.unitsAttempted,
    creditUnitsEarned: a.creditUnitsEarned,
    gpa: a.gpa,
    currentStudyLoad: a.currentStudyLoad,
  }
  if (a.programStatus !== undefined) out.programStatus = a.programStatus
  if (a.majors !== undefined) out.majors = a.majors
  if (a.minors !== undefined) out.minors = a.minors
  if (a.notes !== undefined) out.notes = a.notes
  if (a.confirmedAt !== undefined) out.confirmedAt = FsTimestamp.fromDate(a.confirmedAt)
  return out
}

function studentProfileToStorage(p: StudentProfile): StudentProfileWrite {
  const out: StudentProfileWrite = {
    studentNumber: p.studentNumber,
    profileStatus: p.profileStatus,
  }
  if (p.programCode !== undefined) out.programCode = p.programCode
  if (p.phone !== undefined) out.phone = p.phone
  if (p.academicInfo !== undefined) out.academicInfo = academicInfoToStorage(p.academicInfo)
  if (p.semesterId !== undefined) out.semesterId = p.semesterId
  if (p.semesterSelectedAt !== undefined)
    out.semesterSelectedAt = FsTimestamp.fromDate(p.semesterSelectedAt)
  return out
}

function identityToStorage(i: UserIdentity): UserIdentityWrite {
  const out: UserIdentityWrite = {
    provider: i.provider,
    providerUserId: i.providerUserId,
  }
  if (i.emailSnapshot !== undefined) out.emailSnapshot = i.emailSnapshot
  return out
}

function userToCreatePayload(u: User): UserCreateWrite {
  const out: UserCreateWrite = {
    email: u.email,
    role: u.role,
    status: u.status,
    onboardingStage: u.onboardingStage,
    identity: identityToStorage(u.identity),
    // First persisted version is always 1.
    version: 1,
    _schemaVersion: USER_SCHEMA_VERSION,
  }
  if (u.displayName !== undefined) out.displayName = u.displayName
  if (u.studentProfile !== undefined) out.studentProfile = studentProfileToStorage(u.studentProfile)
  return out
}

function userToUpdatePayload(u: User, nextVersion: number): UserUpdateWrite {
  const out: UserUpdateWrite = {
    status: u.status,
    onboardingStage: u.onboardingStage,
    version: nextVersion,
  }
  if (u.displayName !== undefined) out.displayName = u.displayName
  if (u.studentProfile !== undefined) out.studentProfile = studentProfileToStorage(u.studentProfile)
  return out
}

// ---------------------------------------------------------------------

export const USER_COLLECTION = 'users'
export const USER_IDENTITY_SENTINEL_COLLECTION = 'userIdentities'

export function userIdentitySentinelDocId(identity: UserIdentityLookup): string {
  return `${identity.provider}__${encodeURIComponent(identity.providerUserId)}`
}

/**
 * Session-scoped Firestore implementation of `UserRepository`. Pure-DDD/CQRS
 * write surface — `findById`, `save` (upsert), `delete`. List/identity reads
 * live on `UserQueryService`.
 *
 * Constructed by `FirestoreUnitOfWork.execute` with a live `Transaction`.
 */
export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly txn: Transaction) {}

  async findById(id: string): Promise<User | null> {
    return translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(USER_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) return null
        return parseUser(snap.id, snap.data())
      },
      { op: 'users.findById', resource: 'User', id }
    )
  }

  /**
   * Coordinator roster, read inside the active txn. Used by command
   * handlers for in-transaction notification fan-out (e.g. ticket
   * created → notify all coordinators, atomically). Firestore allows
   * collection-query reads in a transaction as long as they happen
   * before any writes.
   */
  async listCoordinators(): Promise<readonly User[]> {
    return translateFirestoreErrors(
      async () => {
        const query = adminDb.collection(USER_COLLECTION).where('role', '==', 'coordinator')
        const snap = await this.txn.get(query)
        return snap.docs.map((doc) => parseUser(doc.id, doc.data()))
      },
      { op: 'users.listCoordinators', resource: 'User' }
    )
  }

  /** Upsert. `version === 0` → first-write; else optimistic-lock update. */
  async save(user: User): Promise<void> {
    if (user.version === 0) {
      await this.insertNew(user)
      return
    }
    await this.updateExisting(user)
  }

  /**
   * Hard-delete a user + their identity-uniqueness sentinel atomically.
   * The sentinel doc id is rebuilt from the persisted identity (loaded
   * inside the txn) so we never delete a stale key.
   */
  async delete(id: string): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(USER_COLLECTION).doc(id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('User', id)
        const user = parseUser(snap.id, snap.data())
        const sentinelRef = adminDb
          .collection(USER_IDENTITY_SENTINEL_COLLECTION)
          .doc(userIdentitySentinelDocId(user.identity))
        this.txn.delete(sentinelRef)
        this.txn.delete(ref)
      },
      { op: 'users.delete', resource: 'User', id }
    )
  }

  /**
   * Insert path. Writes two docs atomically inside the txn:
   *   1. `users/{id}` — full aggregate including denormalised identity.
   *   2. `userIdentities/{key}` — slim `{ userId }` sentinel via
   *      `txn.create(... exists=false)` to enforce identity uniqueness.
   *
   * The sentinel write fails with `already-exists` if a concurrent register
   * raced past us; that is mapped to
   * `ConflictError('identity_already_exists')` by the error translator.
   */
  private async insertNew(user: User): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(USER_COLLECTION).doc(user.id)
        const sentinelRef = adminDb
          .collection(USER_IDENTITY_SENTINEL_COLLECTION)
          .doc(userIdentitySentinelDocId(user.identity))

        const doc: UserCreateDoc = {
          ...userToCreatePayload(user),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }
        const sentinelDoc: UserIdentitySentinelDoc = {
          userId: ref.id,
          createdAt: FieldValue.serverTimestamp(),
          _schemaVersion: USER_SCHEMA_VERSION,
        }
        this.txn.create(ref, doc)
        this.txn.create(sentinelRef, sentinelDoc)
      },
      { op: 'users.save', resource: 'User', conflictReason: 'identity_already_exists' }
    )
  }

  /**
   * Update path. Reads the current doc's `version` field inside the
   * transaction and rejects with `PreconditionFailedError` if it doesn't
   * match `user.version`. On success, bumps `version` to `stored + 1` and
   * writes only the mutable fields — identity stays put.
   */
  private async updateExisting(user: User): Promise<void> {
    await translateFirestoreErrors(
      async () => {
        const ref = adminDb.collection(USER_COLLECTION).doc(user.id)
        const snap = await this.txn.get(ref)
        if (!snap.exists) throw new NotFoundError('User', user.id)

        const stored = (snap.data()?.['version'] as number | undefined) ?? 0
        if (stored !== user.version) {
          throw new PreconditionFailedError('Resource version does not match')
        }

        const update: UserUpdateDoc = {
          ...userToUpdatePayload(user, stored + 1),
          updatedAt: FieldValue.serverTimestamp(),
        }
        this.txn.update(ref, update)
      },
      { op: 'users.save', resource: 'User', id: user.id }
    )
  }
}

export function parseUser(id: string, raw: unknown): User {
  const parsed = userStorageSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`users/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return mapStorageToUser(id, parsed.data)
}

export function parseUserIdentitySentinel(
  id: string,
  raw: unknown
): z.infer<typeof userIdentitySentinelSchema> {
  const parsed = userIdentitySentinelSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(`userIdentities/${id} storage-shape validation failed: ${parsed.error.message}`)
  }
  return parsed.data
}
