import type { Timestamp } from 'firebase-admin/firestore'
import { User, USER_SCHEMA_VERSION } from '../../../domain/entities/user'
import { StudentProfile } from '../../../domain/value-objects/student-profile'
import { AcademicInfo } from '../../../domain/value-objects/academic-info'
import type { UserStorage } from '../schemas/user'
import { Timestamp as FsTimestamp } from '../../config/firebase-admin'

/**
 * Mappers between Firestore storage shape (Timestamp-based) and the
 * domain aggregate (class-based, Date timestamps).
 *
 * Firestore types stay confined to `infrastructure/firestore/`. Domain
 * aggregates are constructed via their `rehydrate` factories here — no
 * validation runs on the storage path (trust our own data).
 */

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

/**
 * Firestore storage shape → domain `User` aggregate.
 *
 * `version` is the domain-level concurrency token derived from the
 * Firestore `DocumentSnapshot.updateTime.toMillis()` so every successful
 * write produces a strictly greater version. The API layer formats this
 * as the HTTP ETag; the domain itself stays HTTP-free.
 */
export function mapStorageToUser(id: string, version: number, storage: UserStorage): User {
  return User.rehydrate({
    id,
    version,
    firebaseUid: storage.firebaseUid,
    email: storage.email,
    role: storage.role,
    status: storage.status,
    onboardingStage: storage.onboardingStage,
    createdAt: storage.createdAt.toDate(),
    updatedAt: storage.updatedAt.toDate(),
    displayName: storage.displayName,
    studentProfile: storage.studentProfile ? mapStudentProfile(storage.studentProfile) : undefined,
  })
}

/**
 * Build a write-payload for Firestore from an `AcademicInfo` domain VO.
 * Domain `Date` → Firestore `Timestamp`. `confirmedAt` is written as a
 * regular Timestamp once stamped by the aggregate — no FieldValue
 * sentinel is used (we moved to single-write optimistic concurrency).
 */
export function academicInfoToStorage(a: AcademicInfo): Record<string, unknown> {
  const out: Record<string, unknown> = {
    programName: a.programName,
    programLevel: a.programLevel,
    unitsAttempted: a.unitsAttempted,
    creditUnitsEarned: a.creditUnitsEarned,
    gpa: a.gpa,
    currentStudyLoad: a.currentStudyLoad,
  }
  if (a.programStatus !== undefined) out['programStatus'] = a.programStatus
  if (a.majors !== undefined) out['majors'] = a.majors
  if (a.minors !== undefined) out['minors'] = a.minors
  if (a.notes !== undefined) out['notes'] = a.notes
  if (a.confirmedAt !== undefined) out['confirmedAt'] = FsTimestamp.fromDate(a.confirmedAt)
  return out
}

/** Build a write-payload for the embedded `studentProfile` map. */
export function studentProfileToStorage(p: StudentProfile): Record<string, unknown> {
  const out: Record<string, unknown> = {
    studentNumber: p.studentNumber,
    profileStatus: p.profileStatus,
  }
  if (p.programCode !== undefined) out['programCode'] = p.programCode
  if (p.phone !== undefined) out['phone'] = p.phone
  if (p.academicInfo !== undefined) out['academicInfo'] = academicInfoToStorage(p.academicInfo)
  if (p.semesterId !== undefined) out['semesterId'] = p.semesterId
  // semesterSelectedAt is written only via dedicated repository methods.
  return out
}

export { USER_SCHEMA_VERSION }
