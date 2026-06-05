import { Router, type Router as ExpressRouter } from 'express'
import { v1ChatRouter } from './chat'

/** Public v1 routes (no API key) */
export const v1PublicRouter: ExpressRouter = Router()

v1PublicRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok' as const,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
  })
})

/** Protected v1 routes — mount after API key + per-key rate limit middleware */
export const v1ProtectedRouter: ExpressRouter = Router()
v1ProtectedRouter.use(v1ChatRouter)
