import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { authSyncRequestSchema } from '../../schemas/user'
import { userResponseSchema } from '../../dto/user'
import { errorResponseSchema } from '../common'

export const authSyncOperation: ZodOpenApiOperationObject = {
  operationId: 'authSync',
  summary: 'Verify Firebase identity and return/create the platform user',
  description:
    'On first call for a given `firebaseUid` creates a `users/{id}` document, sets `role: student`, and writes Firebase custom claims `{ platformUserId, role }`. Subsequent calls are idempotent. See WORKFLOW-API-SPEC.md §7.1.',
  tags: ['Authentication'],
  security: [{ bearerAuth: [] }],
  requestBody: {
    required: true,
    content: { 'application/json': { schema: authSyncRequestSchema } },
  },
  responses: {
    '201': {
      description:
        'First sync — a new users/{id} document was created. Response includes `Location: /api/v1/users/{id}` and the full user body.',
      headers: {
        Location: { schema: { type: 'string' }, description: 'Canonical URL for the new user' },
        ETag: { schema: { type: 'string' }, description: 'Opaque version token' },
      },
      content: { 'application/json': { schema: userResponseSchema } },
    },
    '200': {
      description: 'Subsequent sync — the existing user is returned.',
      headers: {
        ETag: { schema: { type: 'string' } },
      },
      content: { 'application/json': { schema: userResponseSchema } },
    },
    '400': {
      description: 'Bad request — malformed body.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '401': {
      description: 'Missing or invalid Firebase ID token.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
    '422': {
      description: 'First-time sync missing the required `studentNumber`.',
      content: { 'application/json': { schema: errorResponseSchema } },
    },
  },
}
