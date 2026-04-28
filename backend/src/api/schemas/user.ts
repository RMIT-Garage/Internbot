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

export const authSyncRequestSchema = z
  .object({
    studentNumber: z.string().trim().min(1).optional().meta({
      example: 's1234567',
      description:
        'Required on the first call (creates the student profile). Immutable after first-set; ignored on subsequent calls.',
    }),
    displayName: z.string().trim().min(1).optional().meta({ example: 'Alex Chen' }),
  })
  .strict()
  .meta({
    id: 'AuthSyncRequest',
    description: 'Body for POST /api/v1/auth/sync. All fields optional on repeat calls.',
  })

export type AuthSyncRequest = z.infer<typeof authSyncRequestSchema>

const academicInfoRequestSchema = z
  .object({
    programName: z.string().min(1),
    programLevel: z.enum(programLevelValues),
    unitsAttempted: z.number().nonnegative(),
    creditUnitsEarned: z.number().nonnegative(),
    gpa: z.number().min(0).max(4).meta({ description: 'GPA on the RMIT /4.0 scale.' }),
    currentStudyLoad: z.enum(studyLoadValues),
    programStatus: z.enum(programStatusValues).optional(),
    majors: z.array(z.string()).optional(),
    minors: z.array(z.string()).optional(),
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
    phone: z.string().min(1).nullable().optional(),
    academicInfo: academicInfoRequestSchema.nullable().optional().meta({
      description:
        'Replace the academic info block, or `null` to clear it (returns the profile to incomplete).',
    }),
  })
  .strict()
  .meta({ id: 'StudentProfilePatch' })

export const patchUserRequestSchema = z
  .object({
    studentProfile: studentProfilePatchSchema,
  })
  .strict()
  .meta({
    id: 'PatchUserRequest',
    description:
      'Body for PATCH /api/v1/users/:id. Top-level identity fields (email, role, firebaseUid, status, onboardingStage) are rejected with 400.',
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
  'displayName',
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
