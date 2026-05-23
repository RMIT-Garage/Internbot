import { z } from 'zod'
import {
  internshipCoordinatorDecisionValues,
  internshipStatusValues,
} from '../../domain/value-objects/internship-enums'

const nonEmptyText = z.string().trim().min(1)
const isoDateTime = z.string().datetime()

export const createInternshipRequestSchema = z
  .object({
    opportunityId: nonEmptyText.meta({ example: 'opp_042' }),
  })
  .strict()
  .meta({
    id: 'CreateInternshipRequest',
    description: 'Body for POST /api/v1/internships. See WORKFLOW-API-SPEC.md §7.4.',
  })

export type CreateInternshipRequest = z.infer<typeof createInternshipRequestSchema>

export const patchInternshipRequestSchema = z
  .object({
    offerDate: isoDateTime.optional(),
    startDate: isoDateTime.optional(),
    endDate: isoDateTime.nullable().optional(),
  })
  .strict()
  .meta({
    id: 'PatchInternshipRequest',
    description:
      'Body for PATCH /api/v1/internships/:id. Lifecycle and ownership fields are rejected with 400.',
  })

export type PatchInternshipRequest = z.infer<typeof patchInternshipRequestSchema>

export const submitInternshipOfferRequestSchema = z
  .object({
    offerDate: isoDateTime.optional(),
    startDate: isoDateTime.optional(),
    endDate: isoDateTime.nullable().optional(),
  })
  .strict()
  .meta({
    id: 'SubmitInternshipOfferRequest',
    description:
      'Body for POST /api/v1/internships/:id/offer-submissions. All fields are optional — submission only requires at least one finalized offer attachment. Dates may be supplied later by the coordinator.',
  })

export type SubmitInternshipOfferRequest = z.infer<typeof submitInternshipOfferRequestSchema>

export const addInternshipCommentRequestSchema = z
  .object({
    text: nonEmptyText,
  })
  .strict()
  .meta({
    id: 'AddInternshipCommentRequest',
    description: 'Body for POST /api/v1/internships/:id/comments.',
  })

export type AddInternshipCommentRequest = z.infer<typeof addInternshipCommentRequestSchema>

export const decideInternshipOfferRequestSchema = z
  .object({
    decision: z.enum(internshipCoordinatorDecisionValues),
    comment: nonEmptyText.optional(),
  })
  .strict()
  .meta({
    id: 'DecideInternshipOfferRequest',
    description: 'Body for POST /api/v1/internships/:id/decisions.',
  })

export type DecideInternshipOfferRequest = z.infer<typeof decideInternshipOfferRequestSchema>

const attachmentContentTypeValues = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const createInternshipAttachmentUploadIntentRequestSchema = z
  .object({
    fileName: nonEmptyText.max(200).meta({ example: 'offer-letter.pdf' }),
    contentType: z.enum(attachmentContentTypeValues).meta({ example: 'application/pdf' }),
  })
  .strict()
  .meta({
    id: 'CreateInternshipAttachmentUploadIntentRequest',
    description:
      'Body for POST /api/v1/internships/:id/attachments/upload-intents. Returns a signed PUT URL the student-owner uploads the file bytes to directly.',
  })

export type CreateInternshipAttachmentUploadIntentRequest = z.infer<
  typeof createInternshipAttachmentUploadIntentRequestSchema
>

export const FORBIDDEN_CREATE_INTERNSHIP_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'userId',
  'status',
  'version',
  'createdAt',
  'updatedAt',
  'lastSubmittedAt',
  '_schemaVersion',
])

export const FORBIDDEN_PATCH_INTERNSHIP_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'userId',
  'opportunityId',
  'status',
  'version',
  'coordinatorDecision',
  'coordinatorComment',
  'reviewedByUserId',
  'reviewedAt',
  'createdAt',
  'updatedAt',
  'lastSubmittedAt',
  '_schemaVersion',
])

export const internshipListStatusSchema = z.enum(internshipStatusValues)
