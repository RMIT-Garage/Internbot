import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { problemDetailsSchema } from '../schemas/errors'
import { healthResponseSchema } from '../schemas/common'
import {
  chatMessageRequestSchema,
  chatMessageResponseSchema,
  chatModelsResponseSchema,
} from '../schemas/chat'

export function registerOpenApiPaths(registry: OpenAPIRegistry): void {
  registry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'ibk_live_* | ibk_test_*',
    description:
      'Server-to-server API key issued for the internbot platform. Send as `Authorization: Bearer <key>`. Never expose in browser clients.',
  })

  registry.registerPath({
    method: 'get',
    path: '/v1/health',
    tags: ['Health'],
    summary: 'Liveness check',
    responses: {
      200: {
        description: 'Service is healthy',
        content: { 'application/json': { schema: healthResponseSchema } },
      },
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/v1/chat/message',
    tags: ['Chat'],
    summary: 'Send a chat message',
    description:
      'Runs FAQ RAG, job checker, or contract checker depending on `feature`. Requires a valid API key.',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: { 'application/json': { schema: chatMessageRequestSchema } },
        required: true,
      },
    },
    responses: {
      200: {
        description: 'Assistant reply with optional structured output and citations',
        content: { 'application/json': { schema: chatMessageResponseSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      401: {
        description: 'Missing or invalid API key',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      403: {
        description: 'Revoked API key',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      429: {
        description: 'Too many requests for this API key',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      502: {
        description: 'Upstream model or retrieval failure',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/v1/chat/models',
    tags: ['Chat'],
    summary: 'List Gemini models',
    description: 'Returns model ids suitable for the optional `model` field on chat requests.',
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: 'Available models',
        content: { 'application/json': { schema: chatModelsResponseSchema } },
      },
      400: {
        description: 'Misconfiguration (e.g. missing GEMINI_API_KEY)',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      401: {
        description: 'Missing or invalid API key',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
      429: {
        description: 'Too many requests for this API key',
        content: { 'application/json': { schema: problemDetailsSchema } },
      },
    },
  })
}
