import { z } from 'zod'
import {
  opportunityStatusValues,
  opportunityTypeValues,
  workModeValues,
} from '../../domain/value-objects/opportunity-enums'

export const opportunityAttachmentResponseSchema = z
  .object({
    id: z.string().meta({ example: 'att_001' }),
    fileName: z.string().nullable().meta({ example: 'position-description.pdf' }),
    contentType: z.string().nullable().meta({ example: 'application/pdf' }),
    uploadedAt: z.string().datetime().meta({ example: '2026-04-04T09:05:00Z' }),
  })
  .meta({
    id: 'OpportunityAttachmentResponse',
    description: 'Attachment metadata for an opportunity position-description file.',
  })

export type OpportunityAttachmentResponse = z.infer<typeof opportunityAttachmentResponseSchema>

export const opportunityAttachmentDownloadResponseSchema = opportunityAttachmentResponseSchema
  .extend({
    downloadUrl: z.string().url(),
    downloadUrlExpiresAt: z.string().datetime(),
  })
  .meta({
    id: 'OpportunityAttachmentDownloadResponse',
    description:
      'Opportunity attachment metadata with a fresh short-lived Cloud Storage signed URL.',
  })

export type OpportunityAttachmentDownloadResponse = z.infer<
  typeof opportunityAttachmentDownloadResponseSchema
>

export const opportunityResponseSchema = z
  .object({
    id: z.string().meta({ example: 'opp_042' }),
    semesterId: z.string().meta({ example: 'sem_aBc123XyZ' }),
    type: z.enum(opportunityTypeValues),
    employerName: z.string().meta({ example: 'Example Pty Ltd' }),
    jobTitle: z.string().meta({ example: 'Software Intern' }),
    descriptionText: z.string(),
    workMode: z.enum(workModeValues).nullable(),
    location: z.string().nullable(),
    sourceUrl: z.string().url().nullable(),
    status: z.enum(opportunityStatusValues),
    applicationCount: z.number().int().nonnegative(),
    createdByUserId: z.string().nullable(),
    submittedByUserId: z.string().nullable(),
    verifiedByUserId: z.string().nullable(),
    verifiedAt: z.string().datetime().nullable(),
    attachmentUploadPathPrefix: z.string().meta({
      example: 'opportunities/opp_042/attachments/',
    }),
    attachments: z.array(opportunityAttachmentResponseSchema),
    createdAt: z.string().datetime().meta({ example: '2026-04-04T09:00:00Z' }),
    updatedAt: z.string().datetime().meta({ example: '2026-04-04T09:00:00Z' }),
  })
  .meta({
    id: 'OpportunityResponse',
    description: 'Opportunity record (see WORKFLOW-API-SPEC.md §7.3 / §8.3).',
  })

export type OpportunityResponse = z.infer<typeof opportunityResponseSchema>

export const opportunityListResponseSchema = z
  .object({
    items: z.array(opportunityResponseSchema),
    nextPageToken: z.string().nullable(),
  })
  .meta({
    id: 'OpportunityListResponse',
    description: 'Paginated list of opportunities.',
  })

export type OpportunityListResponse = z.infer<typeof opportunityListResponseSchema>
