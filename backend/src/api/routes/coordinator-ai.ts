import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import { ApiError } from '../errors'

const chatRequestSchema = z.object({
  userInput: z.string().min(1).max(2000),
  useWebSearch: z.boolean().optional(),
  attachment: z
    .object({
      mimeType: z.string().min(1).max(120),
      dataBase64: z.string().min(1).max(2_000_000),
      fileName: z.string().min(1).max(260).optional(),
    })
    .optional(),
})

const checkerRequestSchema = z.object({
  userInput: z.string().min(1).max(10000),
  attachment: z
    .object({
      mimeType: z.string().min(1).max(120),
      dataBase64: z.string().min(1).max(2_000_000),
      fileName: z.string().min(1).max(260).optional(),
    })
    .optional(),
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

export interface CoordinatorAiRouterDeps {
  authz: AuthorizationService
}

export function createCoordinatorAiRouter(deps: CoordinatorAiRouterDeps): ExpressRouter {
  const router: ExpressRouter = Router()

  async function proxyToRag(
    feature: string,
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
    res.status(200).json(feature === 'faq-rag' ? normalizeFaqResponse(data) : data)
  }

  router.post('/chat', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = (req as AuthenticatedRequest).actor
      deps.authz.requireRole(actor, ['coordinator'])

      const parsed = chatRequestSchema.safeParse(req.body)
      if (!parsed.success) {
        const issue = parsed.error.issues[0]
        next(
          new ApiError(422, 'Unprocessable Entity', issue?.message ?? 'Invalid request body', {
            reason: 'invalid_body',
          })
        )
        return
      }

      const { userInput, useWebSearch, attachment } = parsed.data
      await proxyToRag(
        'faq-rag',
        attachment
          ? { userInput, useWebSearch: useWebSearch ?? false, attachment }
          : { userInput, useWebSearch: useWebSearch ?? false },
        res,
        next
      )
    } catch (err) {
      next(err)
    }
  })

  router.post('/job-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = (req as AuthenticatedRequest).actor
      deps.authz.requireRole(actor, ['coordinator'])

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
      await proxyToRag(
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
      const actor = (req as AuthenticatedRequest).actor
      deps.authz.requireRole(actor, ['coordinator'])

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
      await proxyToRag(
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
