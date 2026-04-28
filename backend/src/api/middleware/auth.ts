import type { Request, Response, NextFunction } from 'express'
import type { VerifyToken } from '../auth/firebase-token-verifier'
import type { RequestActor } from '../../application/actor'
import { ApiError } from '../errors'

export interface AuthenticatedRequest extends Request {
  actor: RequestActor
}

/**
 * Auth middleware factory — injects a `VerifyToken` function.
 *
 * Flow per WORKFLOW-API-SPEC.md §7.0 Authorization:
 *   1. Read `Authorization: Bearer <token>` header; 401 if missing/malformed
 *   2. Verify the token (returns `RequestActor` with platform identity read
 *      from Firebase custom claims — no Firestore lookup)
 *   3. Attach `actor` to the request for downstream command/query handlers
 *
 * Only POST /api/v1/auth/sync may run with `actor.platformUser === null`.
 * Every other route's handler must call its own authz check (inline) against
 * `actor.platformUser` to enforce role and ownership rules.
 */
export function createAuthMiddleware(verifyToken: VerifyToken) {
  return async function authMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      next(new ApiError(401, 'Unauthorized', 'Missing or invalid Authorization header'))
      return
    }

    const token = authHeader.slice(7)
    try {
      const actor = await verifyToken(token)
      ;(req as AuthenticatedRequest).actor = actor
      next()
    } catch {
      next(new ApiError(401, 'Unauthorized', 'Invalid or expired token'))
    }
  }
}
