import { z } from 'zod'
import {
  onboardingStageValues,
  profileStatusValues,
  programLevelValues,
  programStatusValues,
  roleValues,
  studyLoadValues,
  userStatusValues,
} from '../../domain/value-objects/user-enums'
import {
  currentWorkflowStepValues,
  internshipStatusValues,
  semesterEnrolmentStateValues,
} from '../../domain/value-objects/workflow-state'
import {
  internshipActivityTypeValues,
  internshipStatusValues as internshipRecordStatusValues,
} from '../../domain/value-objects/internship-enums'
import {
  opportunityActivityTypeValues,
  opportunityStatusValues,
  opportunityVerificationDecisionValues,
} from '../../domain/value-objects/opportunity-enums'

/**
 * Wire-format response DTOs as Zod schemas.
 *
 * Schemas are the source of truth for both the OpenAPI 3.1 document
 * (attached via `.meta({ id })` so zod-openapi lifts them into
 * `components/schemas`) and the TypeScript types (`z.infer<...>`).
 *
 * Rules preserved from the interface-based version:
 *   - ISO 8601 UTC timestamp strings (never Firestore Timestamps)
 *   - `firebaseUid` is NEVER serialized (auth-provider leak)
 *   - Polymorphic on `role` — student carries workflowStep + studentProfile,
 *     coordinator does not
 */

export const currentWorkflowStepSchema = z.enum(currentWorkflowStepValues).meta({
  id: 'CurrentWorkflowStep',
  description:
    "Coarse routing-level workflow step derived from the student's profile and internship state (see WORKFLOW-API-SPEC.md §7.1).",
})
export type CurrentWorkflowStep = z.infer<typeof currentWorkflowStepSchema>

export const internshipStatusSchema = z.enum(internshipStatusValues).meta({
  id: 'InternshipStatus',
  description: 'Fine derived workflow state for display (see WORKFLOW-API-SPEC.md §9.2).',
})
export type InternshipStatus = z.infer<typeof internshipStatusSchema>

export const semesterEnrolmentStateSchema = z.enum(semesterEnrolmentStateValues).meta({
  id: 'SemesterEnrolmentState',
  description:
    'Derived display state for the semester enrolment step (see WORKFLOW-API-SPEC.md §7.2).',
})
export type SemesterEnrolmentState = z.infer<typeof semesterEnrolmentStateSchema>

export const userWorkflowResponseSchema = z
  .object({
    currentWorkflowStep: currentWorkflowStepSchema,
    internshipStatus: internshipStatusSchema,
    semesterEnrolmentState: semesterEnrolmentStateSchema,
  })
  .meta({
    id: 'UserWorkflowResponse',
    description:
      'Body of GET /api/v1/users/{id}/workflow. All three fields are derived (none are persisted).',
  })
export type UserWorkflowResponse = z.infer<typeof userWorkflowResponseSchema>

const activityFeedTypeValues = [
  ...internshipActivityTypeValues,
  ...opportunityActivityTypeValues,
] as const

const activityFeedStatusValues = [
  ...internshipRecordStatusValues,
  ...opportunityStatusValues,
] as const

export const userActivityFeedItemResponseSchema = z
  .object({
    id: z.string().meta({ example: 'act_xYz789aBc' }),
    resourceType: z.enum(['internship', 'opportunity']),
    internshipId: z.string().nullable().meta({ example: 'int_001' }),
    opportunityId: z.string().nullable().meta({ example: 'opp_001' }),
    type: z.enum(activityFeedTypeValues),
    authorUserId: z.string().meta({ example: 'usr_coord01' }),
    authorRole: z.enum(roleValues),
    text: z.string().nullable().meta({ example: 'Offer looks good, approved.' }),
    from: z.enum(activityFeedStatusValues).nullable(),
    to: z.enum(activityFeedStatusValues).nullable(),
    decision: z.enum(opportunityVerificationDecisionValues).nullable(),
    createdAt: z.string().datetime().meta({ example: '2026-04-05T10:30:00Z' }),
  })
  .meta({
    id: 'UserActivityFeedItemResponse',
    description: 'One activity-feed entry authored by the caller.',
  })
export type UserActivityFeedItemResponse = z.infer<typeof userActivityFeedItemResponseSchema>

export const userActivityFeedResponseSchema = z
  .object({
    items: z.array(userActivityFeedItemResponseSchema),
    nextPageToken: z.string().nullable(),
  })
  .meta({
    id: 'UserActivityFeedResponse',
    description: 'Paginated activity feed for the caller.',
  })
export type UserActivityFeedResponse = z.infer<typeof userActivityFeedResponseSchema>

export const academicInfoResponseSchema = z
  .object({
    programName: z.string().meta({ example: 'Bachelor of Software Engineering (Professional)' }),
    programLevel: z.enum(programLevelValues),
    programStatus: z.enum(programStatusValues).optional(),
    majors: z.array(z.string()).optional(),
    minors: z.array(z.string()).optional(),
    unitsAttempted: z.number().meta({ example: 192 }),
    creditUnitsEarned: z.number().meta({ example: 168 }),
    gpa: z.number().meta({ example: 3.2, description: 'GPA on the RMIT /4.0 scale' }),
    currentStudyLoad: z.enum(studyLoadValues),
    completedCourses: z.array(z.string()).meta({
      example: ['SEF30012', 'APT40005', 'PCP20019'],
      description:
        'Self-attested completed course codes. Always present (empty array when none recorded).',
    }),
    yearLevel: z.number().int().meta({
      example: 2,
      description:
        'Derived current year level from creditUnitsEarned on a 96-CP/year load, clamped to [1, 4]. Not persisted.',
    }),
    notes: z.string().optional(),
    confirmedAt: z.string().datetime().nullable().meta({
      example: '2026-04-05T03:14:12Z',
      description:
        'Set once at first profile-complete transition; not rewritten on subsequent edits.',
    }),
  })
  .meta({
    id: 'AcademicInfoResponse',
    description: 'Confirmed academic information on a student profile (see §8.2B).',
  })
export type AcademicInfoResponse = z.infer<typeof academicInfoResponseSchema>

export const studentProfileResponseSchema = z
  .object({
    studentNumber: z.string().meta({ example: 's1234567' }),
    programCode: z.string().nullable().meta({ example: 'BP096' }),
    phone: z.string().nullable().meta({ example: '+61 4 1234 5678' }),
    academicInfo: academicInfoResponseSchema.nullable(),
    semesterId: z.string().nullable().optional().meta({ example: 'sem_aBc123XyZ' }),
    semesterSelectedAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .meta({ example: '2026-04-05T03:14:12Z' }),
    profileStatus: z.enum(profileStatusValues),
  })
  .meta({
    id: 'StudentProfileResponse',
    description: 'Embedded student profile on a User response (see §8.2A).',
  })
export type StudentProfileResponse = z.infer<typeof studentProfileResponseSchema>

const userResponseBase = z.object({
  id: z.string().meta({ example: 'usr_aBc123XyZ' }),
  email: z.string().email().meta({ example: 's1234567@student.rmit.edu.au' }),
  displayName: z.string().nullable().meta({ example: 'Alex Chen' }),
  status: z.enum(userStatusValues),
  onboardingStage: z.enum(onboardingStageValues),
})

export const studentUserResponseSchema = userResponseBase
  .extend({
    role: z.literal(roleValues[0]), // 'student'
    currentWorkflowStep: currentWorkflowStepSchema,
    studentProfile: studentProfileResponseSchema,
  })
  .meta({
    id: 'StudentUserResponse',
    description: 'User record for role=student. Includes studentProfile and workflow step.',
  })
export type StudentUserResponse = z.infer<typeof studentUserResponseSchema>

export const coordinatorUserResponseSchema = userResponseBase
  .extend({
    role: z.literal(roleValues[1]), // 'coordinator'
  })
  .meta({
    id: 'CoordinatorUserResponse',
    description: 'User record for role=coordinator. Identity fields only, no studentProfile.',
  })
export type CoordinatorUserResponse = z.infer<typeof coordinatorUserResponseSchema>

export const userResponseSchema = z
  .discriminatedUnion('role', [studentUserResponseSchema, coordinatorUserResponseSchema])
  .meta({
    id: 'UserResponse',
    description: 'Polymorphic user record — shape depends on `role`.',
  })
export type UserResponse = z.infer<typeof userResponseSchema>
