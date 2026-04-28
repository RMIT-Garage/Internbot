import type { ZodOpenApiOperationObject } from 'zod-openapi'
import { z } from 'zod'

const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: z.string().datetime(),
  })
  .meta({ id: 'HealthResponse' })

export const healthOperation: ZodOpenApiOperationObject = {
  operationId: 'getHealth',
  summary: 'Health probe',
  description: 'Public, unauthenticated. Returns 200 when the backend is serving requests.',
  tags: ['Health'],
  responses: {
    '200': {
      description: 'Service is healthy',
      content: { 'application/json': { schema: healthResponseSchema } },
    },
  },
}
