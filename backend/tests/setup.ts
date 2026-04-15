import { vi } from 'vitest'
import type { Actor } from '../src/application/actor'
import type { TokenVerifier } from '../src/application/ports/tokenVerifier'

// Prevent Firebase Admin from initializing during unit tests.
// createApp() accepts a mockTokenVerifier so adminAuth.verifyIdToken is never called,
// but the module is still imported at load time — this stub prevents the SDK from throwing.
vi.mock('../src/infrastructure/config/firebaseAdmin', () => ({
  adminApp: {},
  adminAuth: { verifyIdToken: vi.fn() },
  adminDb: { collection: vi.fn(), runTransaction: vi.fn() },
  adminStorage: { bucket: vi.fn() },
}))

/**
 * Reusable mock TokenVerifier for unit tests.
 * Inject via createApp({ tokenVerifier: mockTokenVerifier }).
 *
 * Default behavior: verify() rejects (unauthenticated).
 * Override per-test: vi.mocked(mockTokenVerifier.verify).mockResolvedValue(actor)
 */
export const mockActor: Actor = {
  uid: 'test-uid',
  email: 'test@example.com',
}

export const mockTokenVerifier: TokenVerifier = {
  verify: vi.fn().mockRejectedValue(new Error('No token configured for this test')),
}
