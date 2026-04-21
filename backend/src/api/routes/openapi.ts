import { Router, type Router as ExpressRouter } from 'express'
import type { Request, Response, NextFunction } from 'express'
import swaggerUi from 'swagger-ui-express'
import { buildOpenapiDocument } from '../openapi/spec'

/**
 * Mounts `/api/openapi.json` and `/api/docs` publicly (no auth middleware).
 *
 * The JSON doc is the canonical machine-readable contract — frontend codegen
 * (`openapi-typescript`) consumes it, and client SDKs pin to it. Swagger UI
 * at `/api/docs` is for humans exploring the contract interactively.
 *
 * The `servers` block is populated per-request from the current origin so the
 * doc reflects wherever it is being served from (local emulator, dev, prod).
 * No hardcoded Cloud Functions URLs.
 */

function currentOrigin(req: Request): string {
  // `x-forwarded-*` is trustworthy behind Cloud Functions / Cloud Run load
  // balancers; Express honours trust-proxy when set, but we don't set it
  // here — use the forwarded headers directly when present.
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ?? req.protocol
  const host =
    (req.headers['x-forwarded-host'] as string | undefined) ?? req.get('host') ?? 'localhost'
  return `${proto}://${host}`
}

export function createOpenapiRouter(): ExpressRouter {
  const router: ExpressRouter = Router()

  router.get('/openapi.json', (req: Request, res: Response) => {
    const doc = buildOpenapiDocument([
      { url: currentOrigin(req), description: 'Current environment' },
    ])
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.json(doc)
  })

  router.use('/docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
    const doc = buildOpenapiDocument([
      { url: currentOrigin(req), description: 'Current environment' },
    ])
    swaggerUi.setup(doc, { customSiteTitle: 'Internbot API — Docs' })(req, res, next)
  })

  return router
}
