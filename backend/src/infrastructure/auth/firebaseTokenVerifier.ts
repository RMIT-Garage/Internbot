import type { TokenVerifier } from '../../application/ports/tokenVerifier'
import type { Actor } from '../../application/actor'
import { adminAuth } from '../config/firebaseAdmin'

export const firebaseTokenVerifier: TokenVerifier = {
  async verify(token: string): Promise<Actor> {
    const decoded = await adminAuth.verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email,
      claims: decoded as Record<string, unknown>,
    }
  },
}
