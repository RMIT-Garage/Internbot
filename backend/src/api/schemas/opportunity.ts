import { z } from 'zod'
import {
  opportunityTransitionTargetValues,
  opportunityTypeValues,
  opportunityVerificationDecisionValues,
  workModeValues,
} from '../../domain/value-objects/opportunity-enums'

const nonEmptyText = z.string().trim().min(1)

export const createOpportunityRequestSchema = z
  .object({
    semesterId: z.string().trim().min(1).optional(),
    type: z.enum(opportunityTypeValues).optional(),
    employerName: nonEmptyText.meta({ example: 'Example Pty Ltd' }),
    jobTitle: nonEmptyText.meta({ example: 'Software Intern' }),
    descriptionText: nonEmptyText,
    workMode: z.enum(workModeValues).optional(),
    location: nonEmptyText.optional(),
    sourceUrl: z
      .string()
      .url()
      .optional()
      .meta({ example: 'https://careerhub.rmit.edu.au/jobs/12345' }),
  })
  .strict()
  .meta({
    id: 'CreateOpportunityRequest',
    description:
      'Body for POST /api/v1/opportunities. Coordinator and student callers have different server-side defaults. See WORKFLOW-API-SPEC.md §7.3.',
  })

export type CreateOpportunityRequest = z.infer<typeof createOpportunityRequestSchema>

export const patchOpportunityRequestSchema = z
  .object({
    employerName: nonEmptyText.optional(),
    jobTitle: nonEmptyText.optional(),
    descriptionText: nonEmptyText.optional(),
    workMode: z.enum(workModeValues).nullable().optional(),
    location: nonEmptyText.nullable().optional(),
    sourceUrl: z.string().url().nullable().optional(),
  })
  .strict()
  .meta({
    id: 'PatchOpportunityRequest',
    description:
      'Body for PATCH /api/v1/opportunities/:id. Lifecycle fields are rejected with 400. See WORKFLOW-API-SPEC.md §7.3.',
  })

export type PatchOpportunityRequest = z.infer<typeof patchOpportunityRequestSchema>

export const transitionOpportunityRequestSchema = z
  .object({
    to: z.enum(opportunityTransitionTargetValues),
    comment: nonEmptyText.optional(),
  })
  .strict()
  .meta({
    id: 'TransitionOpportunityRequest',
    description:
      'Body for POST /api/v1/opportunities/:id/transitions. See WORKFLOW-API-SPEC.md §7.3.',
  })

export type TransitionOpportunityRequest = z.infer<typeof transitionOpportunityRequestSchema>

export const verifyOpportunityRequestSchema = z
  .object({
    decision: z.enum(opportunityVerificationDecisionValues),
    comment: nonEmptyText.optional(),
  })
  .strict()
  .meta({
    id: 'VerifyOpportunityRequest',
    description:
      'Body for POST /api/v1/opportunities/:id/verifications. See WORKFLOW-API-SPEC.md §7.3.',
  })

export type VerifyOpportunityRequest = z.infer<typeof verifyOpportunityRequestSchema>

const attachmentContentTypeValues = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const createOpportunityAttachmentUploadIntentRequestSchema = z
  .object({
    fileName: nonEmptyText.max(200).meta({ example: 'position-description.pdf' }),
    contentType: z.enum(attachmentContentTypeValues).meta({ example: 'application/pdf' }),
  })
  .strict()
  .meta({
    id: 'CreateOpportunityAttachmentUploadIntentRequest',
    description:
      'Body for POST /api/v1/opportunities/:id/attachments/upload-intents. Returns a signed PUT URL the coordinator uploads the file bytes to directly.',
  })

export type CreateOpportunityAttachmentUploadIntentRequest = z.infer<
  typeof createOpportunityAttachmentUploadIntentRequestSchema
>

export const FORBIDDEN_CREATE_OPPORTUNITY_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'status',
  'createdByUserId',
  'submittedByUserId',
  'verifiedByUserId',
  'verifiedAt',
  'createdAt',
  'updatedAt',
  '_schemaVersion',
])

export const FORBIDDEN_PATCH_OPPORTUNITY_FIELDS: ReadonlySet<string> = new Set([
  'id',
  'semesterId',
  'type',
  'status',
  'createdByUserId',
  'submittedByUserId',
  'verifiedByUserId',
  'verifiedAt',
  'createdAt',
  'updatedAt',
  '_schemaVersion',
])
