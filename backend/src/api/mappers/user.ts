import type { RequestActor } from '../../application/actor'
import type { UserResult } from '../../application/queries/get-user'
import type { UserActivityFeedCursor } from '../../application/read-models/user-activity'
import type {
  ListUserActivityQuery,
  UserActivityFeedResultWithCursor,
} from '../../application/queries/list-user-activity'
import type { UserWorkflowResult } from '../../application/queries/get-user-workflow'
import type {
  AcademicInfoPatch,
  UpdateUserProfileCommand,
} from '../../application/commands/update-user-profile'
import type { SelectSemesterCommand } from '../../application/commands/select-semester'
import type { PatchUserRequest, PutSemesterSelectionRequest } from '../schemas/user'
import type {
  AcademicInfoResponse,
  StudentProfileResponse,
  UserActivityFeedResponse,
  UserResponse,
  UserWorkflowResponse,
} from '../dto/user'
import type { AcademicInfo } from '../../domain/value-objects/academic-info'
import type { StudentProfile } from '../../domain/value-objects/student-profile'
import { deriveWorkflowState } from '../../domain/services/workflow-derivation'
import { formatETag, parseIfMatch } from '../utils/etag'
import { decodePageToken, encodePageToken } from '../utils/pagination'

/**
 * Mappers between api wire shapes and application/domain types. Ensures the
 * four-layer data-model rule: every boundary has a mapper, no type leaks
 * across layers.
 */

// ------------------------------ request → command ------------------------------

export function toSelectSemesterCommand(
  actor: RequestActor,
  userId: string,
  ifMatch: string | undefined,
  body: PutSemesterSelectionRequest
): SelectSemesterCommand {
  const expectedVersion = parseIfMatch(ifMatch)
  return {
    actor,
    userId,
    payload: { semesterId: body.semesterId },
    ...(expectedVersion !== undefined ? { metadata: { expectedVersion } } : {}),
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

export interface ParsedListUserActivityQuery {
  query: ListUserActivityQuery['filter']
  errors: { field: string; code: string; message: string }[]
}

const DEFAULT_ACTIVITY_SORT = { direction: 'desc' as const }

export function parseListUserActivityQuery(
  raw: Record<string, unknown>,
  limit: number
): ParsedListUserActivityQuery {
  const errors: ParsedListUserActivityQuery['errors'] = []
  const sort = parseActivitySort(raw['sort'], errors)

  let cursor: UserActivityFeedCursor | undefined
  if (typeof raw['pageToken'] === 'string' && raw['pageToken'].length > 0) {
    try {
      const decoded = decodePageToken(raw['pageToken'])
      const expectedSort = `createdAt:${sort.direction}`
      const lastCreatedAt = new Date(String(decoded.values[0]))
      if (decoded.sort !== undefined && decoded.sort !== expectedSort) {
        errors.push({
          field: 'pageToken',
          code: 'sort_mismatch',
          message: `pageToken was issued for sort=${decoded.sort} but request specifies ${expectedSort}`,
        })
      } else if (Number.isNaN(lastCreatedAt.getTime())) {
        errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
      } else {
        cursor = {
          sortDirection: sort.direction,
          lastCreatedAt,
          lastDocPath: decoded.path,
        }
      }
    } catch {
      errors.push({ field: 'pageToken', code: 'invalid', message: 'pageToken is malformed' })
    }
  }

  return {
    query: {
      limit,
      sortDirection: sort.direction,
      cursor,
    },
    errors,
  }
}

function parseActivitySort(
  v: unknown,
  errors: ParsedListUserActivityQuery['errors']
): { direction: 'asc' | 'desc' } {
  if (v === undefined) return DEFAULT_ACTIVITY_SORT
  if (typeof v !== 'string') {
    errors.push({ field: 'sort', code: 'invalid', message: 'sort must be a string' })
    return DEFAULT_ACTIVITY_SORT
  }
  if (v === 'createdAt') return { direction: 'asc' }
  if (v === '-createdAt') return { direction: 'desc' }
  errors.push({
    field: 'sort',
    code: 'invalid',
    message: 'sort must be one of: createdAt, -createdAt',
  })
  return DEFAULT_ACTIVITY_SORT
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

export function toUserResponse(result: UserResult): UserResponse {
  const u = result.user
  if (u.isStudent()) {
    // GET /users/:id returns the *coarse* step only — the fine
    // `internshipStatus` and `semesterEnrolmentState` belong to the
    // dedicated workflow sub-resource. We compute the triple anyway and
    // pluck the coarse step so future expansion (Phase 5+) flows through
    // a single derivation function rather than two.
    const { currentWorkflowStep } = deriveWorkflowState(u, undefined, new Date())
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName ?? null,
      status: u.status,
      onboardingStage: u.onboardingStage,
      role: 'student',
      currentWorkflowStep,
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

export function toUserWorkflowResponse(result: UserWorkflowResult): UserWorkflowResponse {
  return {
    currentWorkflowStep: result.workflow.currentWorkflowStep,
    internshipStatus: result.workflow.internshipStatus,
    semesterEnrolmentState: result.workflow.semesterEnrolmentState,
  }
}

export function toUserActivityFeedResponse(
  result: UserActivityFeedResultWithCursor
): UserActivityFeedResponse {
  let nextPageToken: string | null = null
  if (result.cursor) {
    nextPageToken = encodePageToken({
      path: result.cursor.lastDocPath,
      values: [result.cursor.lastCreatedAt.toISOString()],
      sort: `createdAt:${result.cursor.sortDirection}`,
    })
  }

  return {
    items: result.items.map((item) => ({
      id: item.id,
      resourceType: item.resourceType,
      internshipId: item.internshipId ?? null,
      opportunityId: item.opportunityId ?? null,
      type: item.type,
      authorUserId: item.authorUserId,
      authorRole: item.authorRole,
      text: item.text ?? null,
      from: item.from ?? null,
      to: item.to ?? null,
      decision: item.decision ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    nextPageToken,
  }
}

export function etagFrom(result: UserResult): string {
  return formatETag(result.user.version)
}
