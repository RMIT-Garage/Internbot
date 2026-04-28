import { adminAuth } from '../../infrastructure/config/firebase-admin'

/**
 * IdP-level identity the verifier extracts from a bearer token.
 *
 * Deliberately minimal: only what the identity provider itself attests to.
 * Platform identity (`platformUser`) is hydrated separately by the auth
 * middleware so the verifier stays a pure "verify-and-decode" function —
 * a future API-gateway impl that verifies an internal passport ships the
 * same shape and the rest of the auth pipeline does not change.
 *
 * `emailVerified` mirrors the `email_verified` claim. The hydrator uses it
 * to refuse JIT-provisioning a `users/{id}` doc for an email the caller has
 * not proven they own — closing the student-number squatting window where
 * an attacker self-registers `s1234567@student.rmit.edu.au` before the real
 * owner.
 */
export interface VerifiedIdpToken {
  firebaseUid: string
  email: string | undefined
  emailVerified: boolean
}

/**
 * Bearer-token verification: raw ID token → `VerifiedIdpToken`.
 */
export type VerifyToken = (token: string) => Promise<VerifiedIdpToken>

/**
 * Production verifier: validates the JWT signature + expiry against
 * Firebase Admin and returns the IdP identity. No Firestore lookup; no
 * custom-claims read. Platform identity is the middleware's job.
 */
export const verifyFirebaseToken: VerifyToken = async (
  token: string
): Promise<VerifiedIdpToken> => {
  const decoded = await adminAuth.verifyIdToken(token)
  return {
    firebaseUid: decoded.uid,
    email: decoded.email,
    emailVerified: decoded.email_verified === true,
  }
}
