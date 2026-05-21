import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import {
  addInternshipCommentRequestSchema,
  createInternshipAttachmentUploadIntentRequestSchema,
  createInternshipRequestSchema,
  decideInternshipOfferRequestSchema,
  patchInternshipRequestSchema,
  submitInternshipOfferRequestSchema,
} from '../../schemas/internship'
import {
  internshipActivityResponseSchema,
  internshipAttachmentDownloadResponseSchema,
  internshipAttachmentUploadIntentResponseSchema,
  internshipListResponseSchema,
  internshipResponseSchema,
} from '../../dto/internship'
import { errorResponseSchema } from '../common'
import { internshipStatusValues } from '../../../domain/value-objects/internship-enums'

const internshipIdPathParams = z.object({
  id: z.string().meta({ example: 'int_042', description: 'Platform internship id.' }),
})

const internshipAttachmentPathParams = internshipIdPathParams.extend({
  attachmentId: z.string().meta({ example: 'att_101', description: 'Attachment id.' }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

const listInternshipsQuerySchema = z.object({
  status: z.array(z.enum(internshipStatusValues)).optional(),
  opportunityId: z.string().optional(),
  userId: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  pageToken: z.string().optional(),
  sort: z
    .enum(['createdAt', '-createdAt', 'lastSubmittedAt', '-lastSubmittedAt'])
    .optional()
    .meta({ description: 'Default `-createdAt`. Prefix with `-` for descending.' }),
})

export const listInternshipsOperation: ZodOpenApiOperationObject = {
  operationId: 'listInternships',
  summary: 'List internships visible to the caller',
  description:
    'Students are server-filtered to their own internships. Coordinators can list all internships and filter by status, opportunity, or user. See WORKFLOW-API-SPEC.md §7.4.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { query: listInternshipsQuerySchema },
  responses: {
    '200': {
      description: 'Paginated list of internships.',
      content: { 'application/json': { schema: internshipListResponseSchema } },
    },
    '400': {
      description: 'Malformed query string or student attempted to widen user filter.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const getInternshipOperation: ZodOpenApiOperationObject = {
  operationId: 'getInternship',
  summary: 'Return an internship by id',
  description: 'Student owner or coordinator can read an internship.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams },
  responses: {
    '200': {
      description: 'Internship found.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: internshipResponseSchema } },
    },
    '403': {
      description: 'Student cannot see this internship.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const getInternshipAttachmentOperation: ZodOpenApiOperationObject = {
  operationId: 'getInternshipAttachment',
  summary: 'Return an internship attachment download resource',
  description:
    'Returns attachment metadata with a fresh short-lived V4 signed Cloud Storage URL. Students can read only their own internship attachments; coordinators can read all.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipAttachmentPathParams },
  responses: {
    '200': {
      description: 'Attachment found with a fresh signed download URL.',
      content: { 'application/json': { schema: internshipAttachmentDownloadResponseSchema } },
    },
    '403': {
      description: 'Student caller does not own the parent internship.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship or attachment exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const createInternshipAttachmentUploadIntentOperation: ZodOpenApiOperationObject = {
  operationId: 'createInternshipAttachmentUploadIntent',
  summary: 'Reserve an internship attachment upload slot',
  description:
    'Student-owner only. Allowed only while the internship is `applied` or `offer_changes_requested`. Pre-writes the attachment metadata as `uploading` and returns a short-lived V4 signed PUT URL the client uploads the file bytes to directly. The client MUST send a matching `Content-Type` header on the PUT. A GCS object-finalised event flips the attachment to `finalized`.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams },
  requestBody: {
    required: true,
    content: {
      'application/json': { schema: createInternshipAttachmentUploadIntentRequestSchema },
    },
  },
  responses: {
    '201': {
      description: 'Upload intent created. Use `uploadUrl` to PUT the file bytes.',
      content: {
        'application/json': { schema: internshipAttachmentUploadIntentResponseSchema },
      },
    },
    '403': {
      description: 'Caller is not the owning student.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Internship status does not permit attachment upload.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing or invalid `fileName` / `contentType`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const deleteInternshipAttachmentOperation: ZodOpenApiOperationObject = {
  operationId: 'deleteInternshipAttachment',
  summary: 'Delete an internship attachment',
  description:
    'Owner-only (the student whose internship it is). Allowed only while the internship is `applied` or `offer_changes_requested`. Atomically removes the attachment metadata, then deletes the GCS object using `ifGenerationMatch` so a concurrent re-upload on the same path is preserved.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipAttachmentPathParams },
  responses: {
    '204': { description: 'Attachment deleted.' },
    '403': {
      description: 'Caller is not the owning student.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship or attachment exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Internship status does not permit attachment deletion.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const createInternshipOperation: ZodOpenApiOperationObject = {
  operationId: 'createInternship',
  summary: 'Apply to an opportunity',
  description:
    'Student-only. Creates an internship application, apply activity, and coordinator notifications.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: createInternshipRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Internship created.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: internshipResponseSchema } },
    },
    '403': {
      description: 'Caller is not a student.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'Opportunity does not exist.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description:
        'No selected semester, opportunity unpublished, semester mismatch, or duplicate application.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing required fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const patchInternshipOperation: ZodOpenApiOperationObject = {
  operationId: 'patchInternship',
  summary: 'Update internship offer details',
  description:
    'Student-owner only. Coordinators receive 405 and should use decisions or comments instead.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchInternshipRequestSchema } },
  },
  responses: {
    '200': {
      description: 'Internship updated.',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: internshipResponseSchema } },
    },
    '400': {
      description: 'Body contains immutable or unknown fields.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Student caller does not own the internship.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '405': {
      description: 'Coordinator callers cannot PATCH internships.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Internship is terminal and not editable.',
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

export const submitInternshipOfferOperation: ZodOpenApiOperationObject = {
  operationId: 'submitInternshipOffer',
  summary: 'Submit an internship offer for coordinator review',
  description:
    'Student-owner only. Requires at least one offer attachment and transitions applied/changes_requested to offer_pending_review.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: submitInternshipOfferRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Offer submitted.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: internshipResponseSchema } },
    },
    '403': {
      description: 'Caller is not the student owner.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Internship is not in an offer-submittable state.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing offer details or offer attachment.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const addInternshipCommentOperation: ZodOpenApiOperationObject = {
  operationId: 'addInternshipComment',
  summary: 'Add a comment to an internship timeline',
  description:
    'Student owner or coordinator can comment in any internship state. Comments do not rotate the parent ETag.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: addInternshipCommentRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Comment activity created.',
      headers: {
        Location: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: internshipActivityResponseSchema } },
    },
    '403': {
      description: 'Student caller does not own the internship.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing or empty text.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const decideInternshipOfferOperation: ZodOpenApiOperationObject = {
  operationId: 'decideInternshipOffer',
  summary: 'Submit a coordinator decision for an internship offer',
  description:
    'Coordinator-only. Transitions offer_pending_review to approved, changes requested, or rejected and writes an activity plus student notification.',
  tags: ['Internships'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: internshipIdPathParams, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: decideInternshipOfferRequestSchema } },
  },
  responses: {
    '201': {
      description: 'Decision recorded.',
      headers: {
        Location: { schema: { type: 'string' } },
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: internshipResponseSchema } },
    },
    '403': {
      description: 'Caller is not a coordinator.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No internship exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '409': {
      description: 'Internship is not pending offer review.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Stale `If-Match`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Missing comment for changes_requested or rejected decisions.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
