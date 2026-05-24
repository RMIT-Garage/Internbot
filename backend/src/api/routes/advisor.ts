import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ApiError } from '../errors'

const advisorChatRequestSchema = z.object({
  userInput: z.string().min(1).max(2000),
  useWebSearch: z.boolean().optional(),
})

export function createAdvisorRouter(): ExpressRouter {
  const router: ExpressRouter = Router()

  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = advisorChatRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        next(
          new ApiError(422, 'Unprocessable Entity', issue?.message ?? 'Invalid request body', {
            reason: 'invalid_body',
          })
        )
        return
      }

      const ragServiceUrl = process.env.RAG_SERVICE_URL
      if (!ragServiceUrl) {
        next(
          new ApiError(503, 'Service Unavailable', 'AI advisor service is not configured', {
            reason: 'service_unavailable',
          })
        )
        return
      }

      const { userInput, useWebSearch } = parsed.data

      const upstream = await fetch(`${ragServiceUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'faq-rag',
          userInput,
          useWebSearch: useWebSearch ?? false,
        }),
      })

      if (!upstream.ok) {
        const text = await upstream.text().catch(() => '')
        next(
          new ApiError(
            502,
            'Bad Gateway',
            `AI advisor service returned ${upstream.status}: ${text}`.slice(0, 200),
            { reason: 'upstream_error' }
          )
        )
        return
      }

      const data: unknown = await upstream.json()
      res.status(200).json(data)
    } catch (err) {
      next(err)
    }
  })

  return router
}
