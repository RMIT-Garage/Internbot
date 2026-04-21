import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'
import { patchUserRequestSchema } from '../../schemas/user'
import { userResponseSchema } from '../../dto/user'
import { errorResponseSchema } from '../common'

const userIdPathParamsSchema = z.object({
  id: z.string().meta({
    example: 'usr_aBc123XyZ',
    description: 'Platform user id.',
  }),
})

const ifMatchHeaderSchema = z.object({
  'if-match': z.string().optional().meta({
    description: 'Opt-in optimistic concurrency — the current ETag from a prior GET.',
  }),
})

/** Shared 200/401 shape used by both `/users/me` and `/users/:id` getters. */
const getResponses: ZodOpenApiOperationObject['responses'] = {
  '200': {
    description: 'User found',
    headers: { ETag: { schema: { type: 'string' } } },
    content: { 'application/json': { schema: userResponseSchema } },
  },
  '401': {
    description: 'Missing or invalid Firebase ID token (or caller has not yet synced).',
    content: { 'application/json': { schema: errorResponseSchema } },
  },
}

/** Shared write-response shape used by both `/users/me` and `/users/:id` PATCHes. */
const patchResponses: ZodOpenApiOperationObject['responses'] = {
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
    description: 'Missing or invalid Firebase ID token (or caller has not yet synced).',
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
}

export const getMyProfileOperation: ZodOpenApiOperationObject = {
  operationId: 'getMyProfile',
  summary: "Return the caller's own platform user record",
  description:
    "Resolves to the caller's platform user from the decoded token's `platformUserId` claim. Returns 401 when the caller has not yet called `POST /auth/sync`. See WORKFLOW-API-SPEC.md §7.2.",
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  responses: getResponses,
}

export const getUserOperation: ZodOpenApiOperationObject = {
  operationId: 'getUser',
  summary: 'Return a platform user by id',
  description:
    'Polymorphic response shape by role. Students may read only their own record; coordinators may read any. Callers targeting themselves should prefer `GET /users/me`. See WORKFLOW-API-SPEC.md §7.2.',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: userIdPathParamsSchema },
  responses: {
    ...getResponses,
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

export const patchMyProfileOperation: ZodOpenApiOperationObject = {
  operationId: 'patchMyProfile',
  summary: "Update the caller's own student profile",
  description:
    "Resolves to the caller's platform user from the decoded token's `platformUserId` claim. Student-only. Top-level identity fields (`email`, `role`, `firebaseUid`, `status`, `onboardingStage`) are not writable. `profileStatus` is derived server-side. `studentProfile.studentNumber` is immutable after first sync. See WORKFLOW-API-SPEC.md §7.2.",
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  requestParams: { header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchUserRequestSchema } },
  },
  responses: patchResponses,
}

export const patchUserOperation: ZodOpenApiOperationObject = {
  operationId: 'patchUser',
  summary: "Update a student's profile by id",
  description:
    'Student-only. Students may only patch their own record; coordinators get `405 Allow: GET`. Callers targeting themselves should prefer `PATCH /users/me`. See WORKFLOW-API-SPEC.md §7.2.',
  tags: ['Users'],
  security: [{ bearerAuth: [] }],
  requestParams: { path: userIdPathParamsSchema, header: ifMatchHeaderSchema },
  requestBody: {
    required: true,
    content: { 'application/json': { schema: patchUserRequestSchema } },
  },
  responses: patchResponses,
}

export { userIdPathParamsSchema, ifMatchHeaderSchema }
