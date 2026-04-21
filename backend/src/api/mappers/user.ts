import type { RequestActor } from '../../application/actor'
import type { UserResult } from '../../application/models/user'
import type {
  AcademicInfoPatch,
  UpdateUserProfileCommand,
} from '../../application/commands/update-user-profile'
import type { SyncUserCommand } from '../../application/commands/sync-user'
import type { AuthSyncRequest, PatchUserRequest } from '../schemas/user'
import type {
  AcademicInfoResponse,
  CurrentWorkflowStep,
  StudentProfileResponse,
  UserResponse,
} from '../dto/user'
import type { AcademicInfo } from '../../domain/value-objects/academic-info'
import type { StudentProfile } from '../../domain/value-objects/student-profile'
import { formatETag, parseIfMatch } from '../utils/etag'

/**
 * Mappers between api wire shapes and application/domain types. Ensures the
 * four-layer data-model rule: every boundary has a mapper, no type leaks
 * across layers.
 */

// ------------------------------ request → command ------------------------------

export function toSyncUserCommand(actor: RequestActor, body: AuthSyncRequest): SyncUserCommand {
  return {
    actor,
    studentNumber: body.studentNumber,
    displayName: body.displayName,
  }
}

export function toUpdateUserProfileCommand(
  actor: RequestActor,
  userId: string,
  ifMatch: string | undefined,
  body: PatchUserRequest
): UpdateUserProfileCommand {
  const academicInfo = body.studentProfile.academicInfo
  const patch: UpdateUserProfileCommand['patch'] = {}
  if (body.studentProfile.studentNumber !== undefined) {
    patch.studentNumber = body.studentProfile.studentNumber
  }
  if (body.studentProfile.programCode !== undefined) {
    patch.programCode = body.studentProfile.programCode
  }
  if (body.studentProfile.phone !== undefined) {
    patch.phone = body.studentProfile.phone
  }
  if (academicInfo !== undefined) {
    patch.academicInfo = academicInfo === null ? null : (academicInfo as AcademicInfoPatch)
  }

  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    userId,
    patch,
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
  }
}

// ------------------------------ result → response ------------------------------

function dateToIso(d: Date | undefined): string | null {
  return d ? d.toISOString() : null
}

function academicInfoToResponse(a: AcademicInfo): AcademicInfoResponse {
  const out: AcademicInfoResponse = {
    programName: a.programName,
    programLevel: a.programLevel,
    unitsAttempted: a.unitsAttempted,
    creditUnitsEarned: a.creditUnitsEarned,
    gpa: a.gpa,
    currentStudyLoad: a.currentStudyLoad,
    confirmedAt: dateToIso(a.confirmedAt),
  }
  if (a.programStatus !== undefined) out.programStatus = a.programStatus
  if (a.majors !== undefined) out.majors = [...a.majors]
  if (a.minors !== undefined) out.minors = [...a.minors]
  if (a.notes !== undefined) out.notes = a.notes
  return out
}

function studentProfileToResponse(p: StudentProfile): StudentProfileResponse {
  const dto: StudentProfileResponse = {
    studentNumber: p.studentNumber,
    programCode: p.programCode ?? null,
    phone: p.phone ?? null,
    academicInfo: p.academicInfo ? academicInfoToResponse(p.academicInfo) : null,
    profileStatus: p.profileStatus,
  }
  if (p.semesterId !== undefined) dto.semesterId = p.semesterId
  const selectedAt = dateToIso(p.semesterSelectedAt)
  if (selectedAt !== null) dto.semesterSelectedAt = selectedAt
  return dto
}

/**
 * Derive the coarse `currentWorkflowStep` per WORKFLOW-API-SPEC.md §7.1.
 * Phase 1 only knows `profile` / `semester_selection` / `opportunity_browsing`
 * — later phases refine by reading internships.
 */
function deriveWorkflowStep(p: StudentProfile): CurrentWorkflowStep {
  if (p.profileStatus !== 'complete') return 'profile'
  if (!p.semesterId) return 'semester_selection'
  return 'opportunity_browsing'
}

export function toUserResponse(result: UserResult): UserResponse {
  const u = result.user
  if (u.isStudent()) {
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? null,
      status: u.status,
      onboardingStage: u.onboardingStage,
      role: 'student',
      currentWorkflowStep: deriveWorkflowStep(u.studentProfile),
      studentProfile: studentProfileToResponse(u.studentProfile),
    }
  }
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName ?? null,
    status: u.status,
    onboardingStage: u.onboardingStage,
    role: 'coordinator',
  }
}

export function etagFrom(result: UserResult): string {
  return formatETag(result.user.version)
}
