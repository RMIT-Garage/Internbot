import express, { type Express } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createAuthMiddleware } from './middleware/auth'
import { createApiKeyMiddleware } from './middleware/apiKey'
import { createRateLimitByKey } from './middleware/rateLimitByKey'
import { errorHandler } from './middleware/errorHandler'
import { healthRouter } from './routes/health'
import { apiRouter } from './routes'
import { v1PublicRouter, v1ProtectedRouter } from './routes/v1'
import { firebaseTokenVerifier } from '../infrastructure/auth/firebaseTokenVerifier'
import { FirestoreApiKeyRepository } from '../infrastructure/apiKeys/firestoreApiKeyRepository'
import { ApiKeyService } from '../application/apiKeys/ApiKeyService'
import type { TokenVerifier } from '../application/ports/tokenVerifier'
import type { ApiKeyRepository } from '../application/ports/apiKeyRepository'
import { mountOpenApiDocs } from './openapi/swagger'

import './openapi/extendZodOpenApi'
import '../types/expressAugment'

interface AppOptions {
  tokenVerifier?: TokenVerifier
  apiKeyRepository?: ApiKeyRepository
}

/** Global rate limiter — 300 requests per 15 min per IP */
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
  },
})

function resolveApiKeyCacheTtlMs(): number {
  const secondsRaw = process.env.API_KEY_CACHE_TTL_SECONDS
  const seconds = secondsRaw ? Number.parseInt(secondsRaw, 10) : 60
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 60
  return safe * 1000
}

/**
 * Express app factory — composition root.
 * Wires infrastructure implementations to application/api layers.
 *
 * tokenVerifier defaults to firebaseTokenVerifier (production).
 * Pass a mock in tests: createApp({ tokenVerifier: mockTokenVerifier })
 */
export function createApp({
  tokenVerifier = firebaseTokenVerifier,
  apiKeyRepository,
}: AppOptions = {}): Express {
  const app = express()
  app.set('trust proxy', 1)

  const authMiddleware = createAuthMiddleware(tokenVerifier)
  const apiKeyRepo = apiKeyRepository ?? new FirestoreApiKeyRepository()
  const apiKeyService = new ApiKeyService(apiKeyRepo)
  const apiKeyMiddleware = createApiKeyMiddleware({
    apiKeyService,
    cacheTtlMs: resolveApiKeyCacheTtlMs(),
  })
  const rateLimitByKey = createRateLimitByKey()

  app.use(helmet())

  app.use(
    cors((req, callback) => {
      if (req.path.startsWith('/v1') || req.path.startsWith('/api/v1')) {
        callback(null, { origin: false })
        return
      }
      callback(null, { origin: true })
    })
  )

  app.use(globalLimiter)

  app.use(express.json({ limit: '8mb' }))
  app.use(express.urlencoded({ extended: true, limit: '8mb' }))

  app.use('/health', healthRouter)
  app.use('/api/health', healthRouter)

  mountOpenApiDocs(app)

  // Canonical public API mount points (single prefix with Cloud Function base URL)
  app.use('/v1', v1PublicRouter)
  app.use('/v1', apiKeyMiddleware, rateLimitByKey, v1ProtectedRouter)

  // Backward-compatible aliases for previously documented double-prefix paths
  app.use('/api/v1', v1PublicRouter)
  app.use('/api/v1', apiKeyMiddleware, rateLimitByKey, v1ProtectedRouter)

  app.use('/api', authMiddleware, apiRouter)

  app.use((_req, res) => {
    res.status(404).json({
      type: 'https://httpstatuses.io/404',
      title: 'Not Found',
      status: 404,
      detail: 'The requested resource does not exist',
    })
  })

  app.use(errorHandler)

  return app
}
