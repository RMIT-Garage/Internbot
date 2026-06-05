import '../openapi/extendZodOpenApi'
import { z } from 'zod'

export const healthResponseSchema = z
  .object({
    status: z.literal('ok'),
    timestamp: z.string().datetime(),
    environment: z.string(),
  })
  .openapi('HealthResponse')

export type HealthResponse = z.infer<typeof healthResponseSchema>
