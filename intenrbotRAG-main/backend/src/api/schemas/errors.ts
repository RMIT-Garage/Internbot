import '../openapi/extendZodOpenApi'
import { z } from 'zod'

/** RFC 9457 Problem Details — matches {@link errorHandler} JSON body */
export const problemDetailsSchema = z
  .object({
    type: z.string().openapi({ example: 'https://httpstatuses.io/400' }),
    title: z.string().openapi({ example: 'Bad Request' }),
    status: z.number().int().openapi({ example: 400 }),
    detail: z.string().openapi({ example: 'Invalid request payload' }),
  })
  .openapi('ProblemDetails')

export type ProblemDetails = z.infer<typeof problemDetailsSchema>
