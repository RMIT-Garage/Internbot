import type { RequestActor, PlatformUser } from '../../application/actor'
import { adminAuth } from '../../infrastructure/config/firebase-admin'

/**
 * Bearer-token verification: raw ID token → `RequestActor`.
 *
 * The api layer is the outermost ring of Clean Architecture — concrete
 * implementations live here directly, no port indirection.
 */
export type VerifyToken = (token: string) => Promise<RequestActor>

/**
 * Production Firebase ID-token verifier.
 *
 * Platform identity (`platformUserId`, `role`) is read from **Firebase custom
 * claims** carried in the token itself. `POST /auth/sync` sets those claims on
 * first login; subsequent requests read them directly from the decoded token
 * with no Firestore round-trip.
 *
 * If claims are absent the actor's `platformUser` is `null` — only
 * `POST /auth/sync` is permitted in this state.
 */
export const verifyFirebaseToken: VerifyToken = async (token: string): Promise<RequestActor> => {
  const decoded = await adminAuth.verifyIdToken(token)

  const platformUserIdClaim = decoded['platformUserId']
  const roleClaim = decoded['role']

  let platformUser: PlatformUser | null = null
  if (typeof platformUserIdClaim === 'string' && platformUserIdClaim.length > 0) {
    if (roleClaim === 'student' || roleClaim === 'coordinator') {
      platformUser = { id: platformUserIdClaim, role: roleClaim }
    }
  }

  return {
    firebaseUid: decoded.uid,
    email: decoded.email,
    platformUser,
  }
}
