import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import {
  createOpportunityRequestSchema,
  patchOpportunityRequestSchema,
  transitionOpportunityRequestSchema,
  verifyOpportunityRequestSchema,
} from '../../schemas/opportunity'
import {
  opportunityAttachmentDownloadResponseSchema,
  opportunityListResponseSchema,
  opportunityResponseSchema,
} from '../../dto/opportunity'
import { errorResponseSchema } from '../common'
import {
  opportunityStatusValues,
  opportunityTypeValues,
} from '../../../domain/value-objects/opportunity-enums'

const opportunityIdPathParams = z.object({
  id: z.string().meta({ example: 'opp_042', description: 'Platform opportunity id.' }),
})

const opportunityAttachmentPathParams = opportunityIdPathParams.extend({
  attachmentId: z.string().meta({ example: 'att_001', description: 'Attachment id.' }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

const listOpportunitiesQuerySchema = z.object({
  semesterId: z.string().optional(),
  status: z.array(z.enum(opportunityStatusValues)).optional(),
  type: z.enum(opportunityTypeValues).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  pageToken: z.string().optional(),
  sort: z
    .enum(['createdAt', '-createdAt'])
    .optional()
    .meta({ description: 'Default `-createdAt`. Prefix with `-` for descending.' }),
})

export const listOpportunitiesOperation: ZodOpenApiOperationObject = {
  operationId: 'listOpportunities',
  summary: 'List opportunities visible to the caller',
  description:
    'Students are server-filtered to published opportunities in their selected semester. Coordinators can filter by semester, status, and type. See WORKFLOW-API-SPEC.md §7.3.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { query: listOpportunitiesQuerySchema },
  responses: {
    '200': {
      description: 'Paginated list of opportunities.',
      content: { 'application/json': { schema: opportunityListResponseSchema } },
    },
    '400': {
      description: 'Malformed query string or student attempted to widen semester filter.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Student caller has no selected semester.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const getOpportunityOperation: ZodOpenApiOperationObject = {
  operationId: 'getOpportunity',
  summary: 'Return an opportunity by id',
  description:
    'Coordinators can read any opportunity. Students can read only published opportunities in their selected semester.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: opportunityIdPathParams },
  responses: {
    '200': {
      description: 'Opportunity found.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: opportunityResponseSchema } },
    },
    '403': {
      description: 'Student cannot see this opportunity.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No opportunity exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const getOpportunityAttachmentOperation: ZodOpenApiOperationObject = {
  operationId: 'getOpportunityAttachment',
  summary: 'Return an opportunity attachment download resource',
  description:
    'Returns attachment metadata with a fresh short-lived V4 signed Cloud Storage URL. Students can read only attachments on visible opportunities.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: opportunityAttachmentPathParams },
  responses: {
    '200': {
      description: 'Attachment found with a fresh signed download URL.',
      content: { 'application/json': { schema: opportunityAttachmentDownloadResponseSchema } },
    },
    '403': {
      description: 'Student cannot see the parent opportunity.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No opportunity or attachment exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const createOpportunityOperation: ZodOpenApiOperationObject = {
  operationId: 'createOpportunity',
  summary: 'Create an opportunity',
  description:
    'Coordinator-created opportunities start as draft. Student submissions become custom opportunities pending verification.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: createOpportunityRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Opportunity created.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: opportunityResponseSchema } },
    },
    '400': {
      description: 'Malformed body or lifecycle fields supplied.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Student has no selected semester or semester is not active.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing required fields or Career Hub URL not on allowlist.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const patchOpportunityOperation: ZodOpenApiOperationObject = {
  operationId: 'patchOpportunity',
  summary: 'Update opportunity metadata',
  description: 'Coordinator-only. Lifecycle fields are immutable through PATCH.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: opportunityIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchOpportunityRequestSchema } },
  },
  responses: {
    '200': {
      description: 'Opportunity updated.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: opportunityResponseSchema } },
    },
    '400': {
      description: 'Body contains immutable or unknown fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Caller is not a coordinator.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No opportunity exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Empty body or domain validation failure.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const transitionOpportunityOperation: ZodOpenApiOperationObject = {
  operationId: 'transitionOpportunity',
  summary: "Advance an opportunity's coordinator-controlled status",
  description:
    'Coordinator-only. Allowed: draft → published, draft → archived, published → archived. Pending-verification opportunities use /verifications.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: opportunityIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: transitionOpportunityRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Transition applied; activity record written.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: opportunityResponseSchema } },
    },
    '409': {
      description: 'Disallowed state transition.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const verifyOpportunityOperation: ZodOpenApiOperationObject = {
  operationId: 'verifyOpportunity',
  summary: 'Verify or reject a student-submitted opportunity',
  description:
    'Coordinator-only. Applies only to pending_verification opportunities and creates a notification for the submitter.',
  tags: ['Opportunities'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: opportunityIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: verifyOpportunityRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Verification applied.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: opportunityResponseSchema } },
    },
    '409': {
      description: 'Opportunity is not pending verification.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Rejected verification missing comment.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
