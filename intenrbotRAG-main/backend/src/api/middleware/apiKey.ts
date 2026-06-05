import type { Request, Response, NextFunction } from 'express'
import type { ApiKeyRecord } from '../../application/ports/apiKeyRepository'
import type { ApiKeyService } from '../../application/apiKeys/ApiKeyService'
import { hashApiKeyPlaintext, parseApiKeyPlaintext } from '../../application/apiKeys/ApiKeyService'
import { ApiError } from '../errors'

interface CacheEntry {
  record: ApiKeyRecord | null
  expiresAt: number
}

export interface ApiKeyMiddlewareOptions {
  apiKeyService: ApiKeyService
  /** TTL for both positive and negative cache entries (ms) */
  cacheTtlMs: number
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7).trim()
}

export function createApiKeyMiddleware(options: ApiKeyMiddlewareOptions) {
  const cache = new Map<string, CacheEntry>()

  function getFromCache(keyHash: string): ApiKeyRecord | null | undefined {
    const entry = cache.get(keyHash)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      cache.delete(keyHash)
      return undefined
    }
    return entry.record
  }

  function setCache(keyHash: string, record: ApiKeyRecord | null): void {
    cache.set(keyHash, { record, expiresAt: Date.now() + options.cacheTtlMs })
  }

  return async function apiKeyMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    const token = extractBearerToken(req)
    if (!token) {
      next(new ApiError(401, 'Unauthorized', 'Missing or invalid Authorization header'))
      return
    }

    // Legacy demo bypass must not apply to v1
    if (token === 'no-token') {
      next(new ApiError(401, 'Unauthorized', 'Missing or invalid Authorization header'))
      return
    }

    if (!parseApiKeyPlaintext(token)) {
      next(new ApiError(401, 'Unauthorized', 'Invalid API key format'))
      return
    }

    const keyHash = hashApiKeyPlaintext(token)
    const cached = getFromCache(keyHash)
    let record: ApiKeyRecord | null
    if (cached !== undefined) {
      record = cached
    } else {
      record = await options.apiKeyService.verifyByPlaintext(token)
      setCache(keyHash, record)
    }

    if (!record) {
      next(new ApiError(401, 'Unauthorized', 'Invalid API key'))
      return
    }

    if (record.revoked) {
      next(new ApiError(403, 'Forbidden', 'API key has been revoked'))
      return
    }

    req.apiKeyAuth = {
      kind: 'api_key',
      keyId: record.keyHash,
      platform: record.platform,
      env: record.env,
    }
    next()
  }
}
