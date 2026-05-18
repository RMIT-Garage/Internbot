import type { Request, Response, NextFunction } from 'express'
import type { VerifyToken } from '../auth/firebase-token-verifier'
import type { HydratePlatformUser } from '../auth/platform-user-hydrator'
import type { RequestActor } from '../../application/actor'
import { ApiError } from '../errors'

export interface AuthenticatedRequest extends Request {
  actor: RequestActor
}

/**
 * Auth middleware factory — composes IdP verification + platform-identity
 * hydration into a single edge step.
 *
 * Flow per WORKFLOW-API-SPEC.md §7.0 Authorization:
 *   1. Read `Authorization: Bearer <token>` header; 401 if missing/malformed
 *   2. `verifyToken` validates the JWT and returns the IdP identity
 *      (firebaseUid + email)
 *   3. `hydratePlatformUser` resolves the platform user from
 *      `userIdentities/{provider}__{uid}` → `users/{id}`. On first request
 *      from a brand-new student, it transactionally JIT-creates the record
 *      from the IdP-attested email; coordinators are admin-provisioned so
 *      they're already in Firestore by the time they hit the API.
 *   4. Attach the assembled `actor` to the request for downstream handlers
 *
 * `actor.platformUser` is null only if the JIT bootstrap couldn't run
 * (non-student-shape email with no pre-provisioned record — e.g. auth
 * provider drift). Routes treat that as 403, not 401.
 */
export function createAuthMiddleware(
  verifyToken: VerifyToken,
  hydratePlatformUser: HydratePlatformUser
) {
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
    let verified
    try {
      verified = await verifyToken(token)
    } catch {
      next(new ApiError(401, 'Unauthorized', 'Invalid or expired token'))
      return
    }

    try {
      const platformUser = await hydratePlatformUser({
        firebaseUid: verified.firebaseUid,
        email: verified.email,
        emailVerified: verified.emailVerified,
      })
      ;(req as AuthenticatedRequest).actor = {
        firebaseUid: verified.firebaseUid,
        email: verified.email,
        platformUser,
      }
      next()
    } catch (err) {
      // Hydration failure is a server-side problem (Firestore down, JIT
      // create raced and lost, etc.) — do not mask as 401.
      next(err)
    }
  }
}
