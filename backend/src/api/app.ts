import express, { type Express, type RequestHandler } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createAuthMiddleware } from './middleware/auth'
import { errorHandler } from './middleware/error-handler'
import { healthRouter } from './routes/health'
import { createApiRouter } from './routes'
import { createOpenapiRouter } from './routes/openapi'
import { verifyFirebaseToken, type VerifyToken } from './auth/firebase-token-verifier'
import { firebasePlatformClaimsService } from '../infrastructure/services/firebase-platform-claims-service'
import { firestoreUnitOfWork } from '../infrastructure/firestore/firestore-unit-of-work'
import type { UnitOfWork } from '../application/ports/unit-of-work'
import type { PlatformClaimsService } from '../application/ports/platform-claims-service'

export interface AppOptions {
  verifyToken?: VerifyToken
  uow?: UnitOfWork
  platformClaimsService?: PlatformClaimsService
}

/** Global rate limiter — 300 requests per 15 min per IP. */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://httpstatuses.io/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many requests, please try again later',
    error: {
      code: 'rate_limited',
      message: 'Too many requests, please try again later',
    },
  },
})

/**
 * Express app factory — composition root.
 *
 * Production defaults: Firebase token verifier, Firestore UoW, Firebase claims
 * service. Tests inject mocks:
 *   createApp({ verifyToken, uow, platformClaimsService })
 */
export function createApp({
  verifyToken = verifyFirebaseToken,
  uow = firestoreUnitOfWork,
  platformClaimsService = firebasePlatformClaimsService,
}: AppOptions = {}): Express {
  const app = express()

  const authMiddleware = createAuthMiddleware(verifyToken)

  app.use(helmet())
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? false }))
  app.use(globalLimiter as unknown as RequestHandler)
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))

  // Public routes (no auth)
  app.use('/api/health', healthRouter)
  app.use('/api', createOpenapiRouter()) // /api/openapi.json + /api/docs

  // Protected routes — Firebase ID token required
  app.use('/api/v1', authMiddleware, createApiRouter({ uow, platformClaimsService }))

  // 404 handler for unmatched paths
  app.use((_req, res) => {
    res.status(404).json({
      type: 'https://httpstatuses.io/404',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist',
      error: {
        code: 'not_found',
        message: 'The requested resource does not exist',
      },
    })
  })

  // Global error handler (must be last)
  app.use(errorHandler)

  return app
}
