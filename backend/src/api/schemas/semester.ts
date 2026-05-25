import { z } from 'zod'
import {
  semesterStatusValues,
  semesterTransitionTargetValues,
} from '../../domain/value-objects/semester-enums'

/**
 * Request body schemas for `/semesters` routes.
 *
 * Schemas carry `.meta({ id })` for OpenAPI 3.1 generation via zod-openapi —
 * the same Zod object drives runtime validation + the published spec.
 */

/**
 * Semester code format. Platform-chosen, so we accept the documented
 * standard forms (`2026-S1`, `2026-S2`, `2026-SU`, `2026-SP`, `2026-FLEX`)
 * plus any reasonable academic-year + period code. Kept loose intentionally:
 * the spec calls this a "platform-chosen format" with examples, not a
 * strict regex.
 */
const semesterCodeSchema = z.string().trim().min(1)

const courseCodeSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Z0-9]+$/, { message: 'courseCode must be alphanumeric, uppercase' })

export const createSemesterRequestSchema = z
  .object({
    semesterCode: semesterCodeSchema.meta({ example: '2026-S1' }),
    courseCode: courseCodeSchema.meta({ example: 'INTE2710' }),
    displayName: z.string().trim().min(1).meta({ example: 'Semester 1 2026' }),
    status: z.enum(semesterStatusValues),
    enrolmentOpenAt: z.string().datetime().optional().meta({ example: '2026-01-15T00:00:00Z' }),
    enrolmentCloseAt: z.string().datetime().optional().meta({ example: '2026-03-13T23:59:59Z' }),
  })
  .strict()
  .meta({
    id: 'CreateSemesterRequest',
    description:
      'Body for POST /api/v1/semesters. Coordinator-only. See WORKFLOW-API-SPEC.md §7.5.',
  })

export type CreateSemesterRequest = z.infer<typeof createSemesterRequestSchema>

export const patchSemesterRequestSchema = z
  .object({
    displayName: z.string().trim().min(1).optional().meta({ example: 'Semester 1 2026' }),
    enrolmentOpenAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .meta({ example: '2026-01-15T00:00:00Z' }),
    enrolmentCloseAt: z
      .string()
      .datetime()
      .nullable()
      .optional()
      .meta({ example: '2026-03-13T23:59:59Z' }),
  })
  .strict()
  .meta({
    id: 'PatchSemesterRequest',
    description:
      'Body for PATCH /api/v1/semesters/:id. Immutable fields (`id`, `semesterCode`, `courseCode`, `status`) are rejected with 400. Use POST /api/v1/semesters/:id/transitions for status changes. See WORKFLOW-API-SPEC.md §7.5.',
  })

export type PatchSemesterRequest = z.infer<typeof patchSemesterRequestSchema>

export const transitionSemesterRequestSchema = z
  .object({
    to: z.enum(semesterTransitionTargetValues),
    comment: z.string().trim().min(1).optional(),
  })
  .strict()
  .meta({
    id: 'TransitionSemesterRequest',
    description: 'Body for POST /api/v1/semesters/:id/transitions. See WORKFLOW-API-SPEC.md §7.5.',
  })

export type TransitionSemesterRequest = z.infer<typeof transitionSemesterRequestSchema>

/**
 * Top-level fields rejected up front on PATCH with a precise 400 rather
 * than a generic "unrecognized key" failure. Surfaces the §7.5
 * `immutable_field` reason cleanly. Mirrors the pattern in
 * `api/schemas/user.ts`.
 */
export const FORBIDDEN_PATCH_SEMESTER_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'semesterCode',
  'courseCode',
  'status',
  'createdAt',
  'updatedAt',
  '_schemaVersion',
])
