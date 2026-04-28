import { z } from 'zod'
import { semesterStatusValues } from '../../domain/value-objects/semester-enums'

/**
 * Wire-format response DTOs as Zod schemas. Source of truth for both the
 * OpenAPI 3.1 document and TypeScript types (`z.infer<...>`).
 *
 * Rules:
 *   - ISO 8601 UTC timestamp strings (never Firestore Timestamps)
 *   - `enrolmentOpenAt` / `enrolmentCloseAt` are nullable (may be unset)
 *   - `id` from `snapshot.id` (not stored as a document field)
 */

export const semesterResponseSchema = z
  .object({
    id: z.string().meta({ example: 'sem_aBc123XyZ' }),
    semesterCode: z.string().meta({ example: '2026-S1' }),
    courseCode: z.string().meta({ example: 'INTE2710' }),
    displayName: z.string().meta({ example: 'Semester 1 2026' }),
    status: z.enum(semesterStatusValues),
    enrolmentOpenAt: z.string().datetime().nullable(),
    enrolmentCloseAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .meta({
    id: 'SemesterResponse',
    description: 'Semester record (see WORKFLOW-API-SPEC.md §7.5 / §8.5).',
  })

export type SemesterResponse = z.infer<typeof semesterResponseSchema>

export const semesterListResponseSchema = z
  .object({
    items: z.array(semesterResponseSchema),
    nextPageToken: z.string().nullable(),
  })
  .meta({
    id: 'SemesterListResponse',
    description: 'Paginated list of semesters.',
  })

export type SemesterListResponse = z.infer<typeof semesterListResponseSchema>
