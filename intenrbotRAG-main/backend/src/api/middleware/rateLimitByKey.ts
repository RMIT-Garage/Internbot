import rateLimit from 'express-rate-limit'
import type { Request } from 'express'

function resolveMaxPerWindow(): number {
  const raw = process.env.API_KEY_RATE_LIMIT_PER_MIN
  const parsed = raw ? Number.parseInt(raw, 10) : 60
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60
}

/** Rate limiter keyed by API key id (key hash). Apply only after api key middleware. */
export function createRateLimitByKey() {
  const windowMs = 60 * 1000
  const max = resolveMaxPerWindow()

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request): string => {
      const auth = req.apiKeyAuth
      if (!auth?.keyId) return 'unknown'
      return auth.keyId
    },
    message: {
      type: 'https://httpstatuses.io/429',
      title: 'Too Many Requests',
      status: 429,
      detail: 'Too many requests for this API key, please try again later',
    },
  })
}
