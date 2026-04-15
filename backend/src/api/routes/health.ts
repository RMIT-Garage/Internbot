import { Router, type Router as ExpressRouter } from 'express'

const router: ExpressRouter = Router()

/**
 * GET /api/health
 * Returns service health status. No auth required.
 */
router.get('/', (_req, res) => {
  // GOOGLE_CLOUD_PROJECT is auto-set by Cloud Functions runtime; fallback for local.
  const project = process.env.GOOGLE_CLOUD_PROJECT ?? process.env.FIREBASE_PROJECT_ID ?? 'local'
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    project,
    nodeEnv: process.env.NODE_ENV ?? 'development',
  })
})

export { router as healthRouter }
