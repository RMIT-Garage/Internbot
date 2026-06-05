import type { Actor } from '../actor'

/**
 * TokenVerifier — DI contract for auth token verification.
 * Production: firebaseTokenVerifier (infrastructure/auth/firebaseTokenVerifier.ts)
 * Tests: pass a mock directly via createApp({ tokenVerifier: mockVerifier })
 */
export interface TokenVerifier {
  verify(token: string): Promise<Actor>
}
