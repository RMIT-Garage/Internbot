import { z } from 'zod'
import {
  internshipActivityTypeValues,
  internshipCoordinatorDecisionValues,
  internshipStatusValues,
} from '../../domain/value-objects/internship-enums'
import { opportunityTypeValues } from '../../domain/value-objects/opportunity-enums'
import { roleValues } from '../../domain/value-objects/user-enums'
import { attachmentUploadStatusValues } from '../../domain/value-objects/attachment'

export const internshipAttachmentResponseSchema = z
  .object({
    id: z.string().meta({ example: 'att_001' }),
    fileName: z.string().nullable().meta({ example: 'offer-letter.pdf' }),
    contentType: z.string().nullable().meta({ example: 'application/pdf' }),
    uploadedAt: z.string().datetime().meta({ example: '2026-04-05T02:50:00Z' }),
    uploadStatus: z.enum(attachmentUploadStatusValues).meta({
      example: 'finalized',
      description:
        'Lifecycle state. `uploading` = intent issued, signed URL outstanding, GCS object not confirmed yet. `finalized` = OBJECT_FINALIZE event observed, file is downloadable.',
    }),
  })
  .meta({
    id: 'InternshipAttachmentResponse',
    description: 'Attachment metadata for an internship offer document.',
  })

export type InternshipAttachmentResponse = z.infer<typeof internshipAttachmentResponseSchema>

export const internshipAttachmentDownloadResponseSchema = internshipAttachmentResponseSchema
  .extend({
    downloadUrl: z.string().url(),
    downloadUrlExpiresAt: z.string().datetime(),
  })
  .meta({
    id: 'InternshipAttachmentDownloadResponse',
    description:
      'Internship attachment metadata with a fresh short-lived Cloud Storage signed URL.',
  })

export type InternshipAttachmentDownloadResponse = z.infer<
  typeof internshipAttachmentDownloadResponseSchema
>

export const internshipAttachmentUploadIntentResponseSchema = z
  .object({
    attachmentId: z.string().meta({ example: 'att_001' }),
    filePath: z.string().meta({
      example: 'users/usr_aBc123XyZ/internships/int_042/attachments/att_001-offer-letter.pdf',
    }),
    uploadUrl: z.string().url().meta({
      example:
        'https://storage.googleapis.com/...attachments/att_001-offer-letter.pdf?X-Goog-Signature=...',
    }),
    uploadExpiresAt: z.string().datetime().meta({ example: '2026-04-04T09:15:00Z' }),
    contentType: z.string().meta({ example: 'application/pdf' }),
  })
  .meta({
    id: 'InternshipAttachmentUploadIntentResponse',
    description:
      'V4 signed PUT URL the student-owner can upload an offer document to. The URL is bound to the supplied `contentType` — the client MUST send a matching `Content-Type` header on the PUT.',
  })

export type InternshipAttachmentUploadIntentResponse = z.infer<
  typeof internshipAttachmentUploadIntentResponseSchema
>

export const internshipResponseSchema = z
  .object({
    id: z.string().meta({ example: 'int_042' }),
    userId: z.string().meta({ example: 'usr_aBc123XyZ' }),
    opportunityId: z.string().meta({ example: 'opp_042' }),
    studentProgramCode: z.string().nullable().meta({ example: 'BP096' }),
    opportunityEmployerName: z.string().meta({ example: 'Example Pty Ltd' }),
    opportunityJobTitle: z.string().meta({ example: 'Software Intern' }),
    opportunityType: z.enum(opportunityTypeValues),
    opportunitySourceUrl: z.string().url().nullable(),
    status: z.enum(internshipStatusValues),
    version: z.number().int().nonnegative(),
    coordinatorDecision: z.enum(internshipCoordinatorDecisionValues).nullable(),
    coordinatorComment: z.string().nullable(),
    reviewedByUserId: z.string().nullable(),
    reviewedAt: z.string().datetime().nullable(),
    offerDate: z.string().datetime().nullable(),
    startDate: z.string().datetime().nullable(),
    endDate: z.string().datetime().nullable(),
    attachmentUploadPathPrefix: z.string().meta({
      example: 'users/usr_aBc123XyZ/internships/int_042/attachments/',
    }),
    attachments: z.array(internshipAttachmentResponseSchema),
    lastSubmittedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime().meta({ example: '2026-04-04T09:00:00Z' }),
    updatedAt: z.string().datetime().meta({ example: '2026-04-04T09:00:00Z' }),
  })
  .meta({
    id: 'InternshipResponse',
    description: 'Internship record (see WORKFLOW-API-SPEC.md §7.4 / §8.4).',
  })

export type InternshipResponse = z.infer<typeof internshipResponseSchema>

export const internshipListItemResponseSchema = internshipResponseSchema
  .pick({
    id: true,
    userId: true,
    opportunityId: true,
    studentProgramCode: true,
    opportunityEmployerName: true,
    opportunityJobTitle: true,
    opportunityType: true,
    opportunitySourceUrl: true,
    status: true,
    lastSubmittedAt: true,
    createdAt: true,
  })
  .meta({
    id: 'InternshipListItemResponse',
    description: 'Internship list item with query-time denormalized display fields.',
  })

export type InternshipListItemResponse = z.infer<typeof internshipListItemResponseSchema>

export const internshipListResponseSchema = z
  .object({
    items: z.array(internshipListItemResponseSchema),
    nextPageToken: z.string().nullable(),
  })
  .meta({
    id: 'InternshipListResponse',
    description: 'Paginated list of internships.',
  })

export type InternshipListResponse = z.infer<typeof internshipListResponseSchema>

export const internshipActivityResponseSchema = z
  .object({
    id: z.string().meta({ example: 'act_xYz789aBc' }),
    type: z.enum(internshipActivityTypeValues),
    authorUserId: z.string().meta({ example: 'usr_aBc123XyZ' }),
    authorRole: z.enum(roleValues),
    text: z.string().nullable(),
    createdAt: z.string().datetime().meta({ example: '2026-04-05T03:14:12Z' }),
  })
  .meta({
    id: 'InternshipActivityResponse',
    description: 'Activity entry under internships/{id}/activity.',
  })

export type InternshipActivityResponse = z.infer<typeof internshipActivityResponseSchema>
