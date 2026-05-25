import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ApiError } from '../errors'

const attachmentSchema = z
  .object({
    mimeType: z.string().min(1).max(120),
    dataBase64: z.string().min(1).max(2_000_000),
    fileName: z.string().min(1).max(260).optional(),
  })
  .optional()

const advisorChatRequestSchema = z.object({
  userInput: z.string().min(1).max(2000),
  useWebSearch: z.boolean().optional(),
  attachment: attachmentSchema,
})

const checkerRequestSchema = z.object({
  userInput: z.string().min(1).max(10000),
  attachment: attachmentSchema,
})

function normalizeFaqResponse(data: Record<string, unknown>): Record<string, unknown> {
  const structured = data.structuredData as
    | { type: string; data: Record<string, unknown> }
    | undefined
  if (structured?.type === 'faq' && typeof structured.data?.answer === 'string') {
    return {
      ...data,
      reply: structured.data.answer,
      contentType: 'plain',
      contentBlocks: undefined,
      sources: [],
      webSources: [],
    }
  }
  return data
}

async function proxyCheckerToRag(
  feature: 'job-checker' | 'contract-checker',
  body: Record<string, unknown>,
  res: Response,
  next: NextFunction
): Promise<void> {
  const ragServiceUrl = process.env.RAG_SERVICE_URL
  if (!ragServiceUrl) {
    next(
      new ApiError(503, 'Service Unavailable', 'AI advisor service is not configured', {
        reason: 'service_unavailable',
      })
    )
    return
  }

  const upstream = await fetch(`${ragServiceUrl}/api/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feature, ...body }),
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

  const data = (await upstream.json()) as Record<string, unknown>
  res.status(200).json(data)
}

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

      const { userInput, useWebSearch, attachment } = parsed.data

      const upstream = await fetch(`${ragServiceUrl}/api/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feature: 'faq-rag',
          userInput,
          useWebSearch: useWebSearch ?? false,
          ...(attachment ? { attachment } : {}),
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

      const data = (await upstream.json()) as Record<string, unknown>
      res.status(200).json(normalizeFaqResponse(data))
    } catch (err) {
      next(err)
    }
  })

  router.post('/job-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = checkerRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        next(
          new ApiError(422, 'Unprocessable Entity', issue?.message ?? 'Invalid request body', {
            reason: 'invalid_body',
          })
        )
        return
      }
      const { userInput, attachment } = parsed.data
      await proxyCheckerToRag(
        'job-checker',
        attachment ? { userInput, attachment } : { userInput },
        res,
        next
      )
    } catch (err) {
      next(err)
    }
  })

  router.post('/contract-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = checkerRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        next(
          new ApiError(422, 'Unprocessable Entity', issue?.message ?? 'Invalid request body', {
            reason: 'invalid_body',
          })
        )
        return
      }
      const { userInput, attachment } = parsed.data
      await proxyCheckerToRag(
        'contract-checker',
        attachment ? { userInput, attachment } : { userInput },
        res,
        next
      )
    } catch (err) {
      next(err)
    }
  })

  return router
}
