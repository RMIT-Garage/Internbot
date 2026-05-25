import { z } from 'zod'

export const semesterStudentPlacementStatusValues = [
  'no_applications',
  'browsing',
  'offer_in_review',
  'offer_changes_requested',
  'offer_approved',
  'all_rejected',
] as const

export const semesterStudentItemSchema = z
  .object({
    userId: z.string(),
    displayName: z.string().nullable(),
    studentNumber: z.string().nullable(),
    programCode: z.string().nullable(),
    semesterSelectedAt: z.string().datetime().nullable(),
    placementStatus: z.enum(semesterStudentPlacementStatusValues),
    internshipCount: z.number().int().nonnegative(),
  })
  .meta({
    id: 'SemesterStudentItem',
    description: 'A student enrolled in a semester with their placement status.',
  })

export type SemesterStudentItemDto = z.infer<typeof semesterStudentItemSchema>

export const semesterStudentListResponseSchema = z
  .object({
    items: z.array(semesterStudentItemSchema),
    nextPageToken: z.string().nullable(),
    totalCount: z.number().int().nonnegative(),
  })
  .meta({
    id: 'SemesterStudentListResponse',
    description: 'Paginated list of students enrolled in a semester.',
  })

export type SemesterStudentListResponse = z.infer<typeof semesterStudentListResponseSchema>
