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

export const currentWorkflowStepSchema = z
  .enum(['profile', 'semester_selection', 'opportunity_browsing', 'offer_stage', 'completed'])
  .meta({
    id: 'CurrentWorkflowStep',
    description:
      "Coarse routing-level workflow step derived from the student's profile and internship state (see WORKFLOW-API-SPEC.md §7.1).",
  })
export type CurrentWorkflowStep = z.infer<typeof currentWorkflowStepSchema>

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
    notes: z.string().optional(),
    confirmedAt: z.string().datetime().nullable().meta({
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
    phone: z.string().nullable(),
    academicInfo: academicInfoResponseSchema.nullable(),
    semesterId: z.string().nullable().optional(),
    semesterSelectedAt: z.string().datetime().nullable().optional(),
    profileStatus: z.enum(profileStatusValues),
  })
  .meta({
    id: 'StudentProfileResponse',
    description: 'Embedded student profile on a User response (see §8.2A).',
  })
export type StudentProfileResponse = z.infer<typeof studentProfileResponseSchema>

const userResponseBase = z.object({
  id: z.string().meta({ example: 'usr_aBc123XyZ' }),
  email: z.string().email(),
  displayName: z.string().nullable(),
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
