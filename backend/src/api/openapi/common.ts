import { z } from 'zod'

/**
 * Shared OpenAPI schemas — the error envelope (RFC 9457 + domain sub-codes)
 * and a handful of reusable primitives. Any operation that documents a 4xx/5xx
 * response references `ErrorResponse`.
 */

export const errorFieldSchema = z
  .object({
    field: z.string().meta({ example: 'studentProfile.studentNumber' }),
    code: z.string().meta({ example: 'immutable' }),
    message: z.string(),
  })
  .meta({ id: 'ErrorField' })

export const errorBodySchema = z
  .object({
    code: z
      .enum([
        'bad_request',
        'unauthorized',
        'forbidden',
        'not_found',
        'method_not_allowed',
        'conflict',
        'precondition_failed',
        'validation_failed',
        'rate_limited',
        'service_unavailable',
        'internal_error',
      ])
      .meta({ description: 'Coarse machine-readable code aligned to HTTP status class.' }),
    reason: z.string().optional().meta({
      description: 'Fine-grained sub-code for client UX branching (see WORKFLOW-API-SPEC.md §7.0).',
      example: 'student_not_owner',
    }),
    message: z.string(),
    fields: z.array(errorFieldSchema).optional(),
  })
  .meta({ id: 'ErrorBody' })

export const errorResponseSchema = z
  .object({
    type: z.string().meta({ example: 'https://httpstatuses.io/403' }),
    title: z.string().meta({ example: 'Forbidden' }),
    status: z.number().int(),
    detail: z.string(),
    error: errorBodySchema,
  })
  .meta({
    id: 'ErrorResponse',
    description:
      'RFC 9457 Problem Details wrapped with the domain error envelope — see docs/ERROR-HANDLING.md.',
  })

export const openapiJsonContent = {
  'application/json': { schema: errorResponseSchema },
} as const
