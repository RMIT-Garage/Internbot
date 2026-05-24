import { z } from 'zod'
import {
  programLevelValues,
  programStatusValues,
  studyLoadValues,
} from '../../domain/value-objects/user-enums'

/**
 * Request body schemas for user-facing routes. Zod lives only at api/infra
 * boundaries — domain and application are zod-free.
 *
 * Schemas carry `.meta({ id })` for OpenAPI 3.1 generation via zod-openapi;
 * the same Zod object drives runtime validation + the published spec.
 */

const academicInfoRequestSchema = z
  .object({
    programName: z
      .string()
      .min(1)
      .meta({ example: 'Bachelor of Software Engineering (Professional)' }),
    programLevel: z.enum(programLevelValues),
    unitsAttempted: z.number().nonnegative().meta({ example: 192 }),
    creditUnitsEarned: z.number().nonnegative().meta({ example: 168 }),
    gpa: z
      .number()
      .min(0)
      .max(4)
      .meta({ example: 3.2, description: 'GPA on the RMIT /4.0 scale.' }),
    currentStudyLoad: z.enum(studyLoadValues),
    programStatus: z.enum(programStatusValues).optional(),
    majors: z
      .array(z.string())
      .optional()
      .meta({ example: ['Software Engineering'] }),
    minors: z
      .array(z.string())
      .optional()
      .meta({ example: ['Data Science'] }),
    completedCourses: z
      .array(z.string().trim().min(1))
      .optional()
      .meta({
        example: ['SEF30012', 'APT40005', 'PCP20019'],
        description:
          'Self-attested completed course codes (e.g. internship prerequisites). Not verified against an academic record.',
      }),
    notes: z.string().optional(),
  })
  .strict()
  .meta({ id: 'AcademicInfoRequest' })

export const studentProfilePatchSchema = z
  .object({
    studentNumber: z.string().min(1).optional().meta({
      description:
        'Same value as first-sync is a no-op; a different value returns 400 `immutable_field`.',
    }),
    programCode: z.string().min(1).optional().meta({ example: 'BP096' }),
    phone: z.string().min(1).nullable().optional().meta({ example: '+61 4 1234 5678' }),
    academicInfo: academicInfoRequestSchema.nullable().optional().meta({
      description:
        'Replace the academic info block, or `null` to clear it (returns the profile to incomplete).',
    }),
  })
  .strict()
  .meta({ id: 'StudentProfilePatch' })

export const patchUserRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).max(100).optional().meta({
      example: 'Jane Doe',
      description:
        'The student-facing display name. Self-settable after sign-up (registration no longer captures a name). Trimmed; 1–100 chars.',
    }),
    studentProfile: studentProfilePatchSchema.optional(),
  })
  .strict()
  .meta({
    id: 'PatchUserRequest',
    description:
      'Body for PATCH /api/v1/users/:id. `displayName` and `studentProfile` are both writable and optional (send either or both). Other top-level identity fields (email, role, firebaseUid, status, onboardingStage) are rejected with 400.',
  })

export type PatchUserRequest = z.infer<typeof patchUserRequestSchema>

/**
 * Top-level fields rejected up front with a precise 400 rather than a generic
 * Zod "unrecognized key" failure. Keeps the spec §7.2 `immutable_field`
 * reason cleanly surfaced.
 */
export const FORBIDDEN_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'email',
  'role',
  'firebaseUid',
  'status',
  'onboardingStage',
  'createdAt',
  'updatedAt',
  '_schemaVersion',
])

export const putSemesterSelectionRequestSchema = z
  .object({
    semesterId: z.string().min(1).meta({
      example: 'sem_aBc123XyZ',
      description: 'The active semester to enrol in (see WORKFLOW-API-SPEC.md §7.6).',
    }),
  })
  .strict()
  .meta({
    id: 'PutSemesterSelectionRequest',
    description: 'Body for PUT /api/v1/users/:id/semester-selection.',
  })

export type PutSemesterSelectionRequest = z.infer<typeof putSemesterSelectionRequestSchema>
