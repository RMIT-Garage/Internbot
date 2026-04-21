import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import { patchUserRequestSchema } from '../../schemas/user'
import { userResponseSchema } from '../../dto/user'
import { errorResponseSchema } from '../common'

const userIdPathParamsSchema = z.object({
  id: z.string().meta({
    example: 'usr_aBc123XyZ',
    description: 'Platform user id. Accepts the alias `me` to target the caller.',
  }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

export const getUserOperation: ZodOpenApiOperationObject = {
  operationId: 'getUser',
  summary: 'Return a platform user',
  description:
    'Polymorphic response shape by role. Students may read only their own record; coordinators may read any. See WORKFLOW-API-SPEC.md §7.2.',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: userIdPathParamsSchema },
  responses: {
    '200': {
      description: 'User found',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: userResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Student caller is not the owner of the requested user.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '404': {
      description: 'No user exists with the supplied id.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export const patchUserOperation: ZodOpenApiOperationObject = {
  operationId: 'patchUser',
  summary: "Update the caller's student profile",
  description:
    'Student-only. Top-level identity fields (`email`, `role`, `firebaseUid`, `status`, `onboardingStage`) are not writable. `profileStatus` is derived server-side. `studentProfile.studentNumber` is immutable after first sync. See WORKFLOW-API-SPEC.md §7.2.',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: userIdPathParamsSchema, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchUserRequestSchema } },
  },
  responses: {
    '200': {
      description: 'User updated',
      headers: { ETag: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: userResponseSchema } },
    },
    '400': {
      description: 'Body contains non-writable fields or violates `studentNumber` immutability.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '403': {
      description: 'Student caller is not the owner of the target user.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '405': {
      description:
        'Coordinator caller — coordinators have no writable user fields in v1. Response includes `Allow: GET`.',
      headers: { Allow: { schema: { type: 'string' } } },
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '412': {
      description: 'Client sent `If-Match` and it does not match the current ETag.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'Semantic validation failure (empty body, missing required fields, etc.).',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}

export { userIdPathParamsSchema, ifMatchHeaderSchema }
