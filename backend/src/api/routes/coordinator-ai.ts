import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import type { AuthenticatedRequest } from '../middleware/auth'
import type { AuthorizationService } from '../../application/ports/authorization-service'
import { ApiError } from '../errors'

const chatRequestSchema = z.object({
  userInput: z.string().min(1).max(2000),
  useWebSearch: z.boolean().optional(),
})

const checkerRequestSchema = z.object({
  userInput: z.string().min(1).max(10000),
})

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

    const data: unknown = await upstream.json()
    res.status(200).json(data)
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

      const { userInput, useWebSearch } = parsed.data
      await proxyToRag('faq-rag', { userInput, useWebSearch: useWebSearch ?? false }, res, next)
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

      await proxyToRag('job-checker', { userInput: parsed.data.userInput }, res, next)
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

      await proxyToRag('contract-checker', { userInput: parsed.data.userInput }, res, next)
    } catch (err) {
      next(err)
    }
  })

  return router
}
