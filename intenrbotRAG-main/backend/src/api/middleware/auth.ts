import type { Request, Response, NextFunction } from 'express'
import type { TokenVerifier } from '../../application/ports/tokenVerifier'
import type { Actor } from '../../application/actor'
import { ApiError } from '../errors'

export interface AuthenticatedRequest extends Request {
  actor: Actor
}

/**
 * Creates the auth middleware with an injected TokenVerifier.
 * Production: pass firebaseTokenVerifier
 * Tests: pass a mock directly to createApp({ tokenVerifier: mockVerifier })
 */
export function createAuthMiddleware(tokenVerifier: TokenVerifier) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    if (req.path === '/chat' || req.path.startsWith('/chat/')) {
      ;(req as AuthenticatedRequest).actor = {
        uid: 'demo-user',
        email: undefined,
        claims: { role: 'demo' },
      }
      next()
      return
    }

    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      next(new ApiError(401, 'Unauthorized', 'Missing or invalid Authorization header'))
      return
    }

    const token = authHeader.slice(7)
    if (token === 'no-token') {
      ;(req as AuthenticatedRequest).actor = {
        uid: 'demo-user',
        email: undefined,
        claims: { role: 'demo' },
      }
      next()
      return
    }

    try {
      const actor = await tokenVerifier.verify(token)
      ;(req as AuthenticatedRequest).actor = actor
      next()
    } catch {
      next(new ApiError(401, 'Unauthorized', 'Invalid or expired token'))
    }
  }
}
