import { vi } from 'vitest'
import type { RequestActor, PlatformUser } from '../src/application/actor'
import type { VerifyToken } from '../src/api/auth/firebase-token-verifier'
import type { UnitOfWork, UnitOfWorkContext } from '../src/application/ports/unit-of-work'
import type { UserRepository } from '../src/domain/repositories/user-repository'
import type { SemesterRepository } from '../src/domain/repositories/semester-repository'
import type { PlatformClaimsService } from '../src/application/ports/platform-claims-service'
import type { IdGenerator } from '../src/application/ports/id-generator'

// Prevent Firebase Admin from initializing during unit tests. createApp()
// accepts DI for every external dep so the admin SDK is never reached, but
// the module is imported at load time — this stub keeps that load cheap.
vi.mock('../src/infrastructure/config/firebase-admin', () => ({
  adminApp: {},
  adminAuth: { verifyIdToken: vi.fn(), setCustomUserClaims: vi.fn() },
  adminDb: { collection: vi.fn(), runTransaction: vi.fn() },
  adminStorage: { bucket: vi.fn() },
  FieldValue: { serverTimestamp: vi.fn(() => '__SERVER_TS__') },
  Timestamp: class {},
}))

/**
 * Build a RequestActor for tests. Default is pre-sync (no platform user) —
 * only POST /auth/sync is legal. Pass `{ platformUser: { id, role } }` to
 * simulate an authenticated, synced caller.
 */
export function buildRequestActor(overrides: Partial<RequestActor> = {}): RequestActor {
  return {
    firebaseUid: 'fb_test_uid',
    email: 'test@example.com',
    platformUser: null,
    ...overrides,
  }
}

export function buildPlatformUser(overrides: Partial<PlatformUser> = {}): PlatformUser {
  return { id: 'usr_test001', role: 'student', ...overrides }
}

/**
 * Mock token verifier — default rejects (unauthenticated).
 *   vi.mocked(mockVerifyToken).mockResolvedValue(buildRequestActor({ platformUser: ... }))
 */
export const mockVerifyToken: VerifyToken = vi
  .fn<(token: string) => Promise<RequestActor>>()
  .mockRejectedValue(new Error('No token configured for this test'))

/**
 * Mock PlatformClaimsService — `set` no-ops by default.
 */
export const mockPlatformClaimsService: PlatformClaimsService = {
  set: vi.fn().mockResolvedValue(undefined),
}

/**
 * Mock IdGenerator — yields predictable counter-based ids `id_test_001`,
 * `id_test_002`, … so tests asserting on the generated id stay stable.
 */
export function buildMockIdGenerator(prefix = 'id_test'): IdGenerator {
  let counter = 0
  return {
    next: vi.fn(() => `${prefix}_${String(++counter).padStart(3, '0')}`),
  }
}

export interface MockUserRepository {
  findById: ReturnType<typeof vi.fn>
  findByIdentity: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
}

export function buildMockUserRepository(): MockUserRepository {
  return {
    findById: vi.fn(),
    findByIdentity: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  }
}

export interface MockSemesterRepository {
  findById: ReturnType<typeof vi.fn>
  findByNaturalKey: ReturnType<typeof vi.fn>
  list: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
}

export function buildMockSemesterRepository(): MockSemesterRepository {
  return {
    findById: vi.fn(),
    findByNaturalKey: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
  }
}

export function buildMockUow(
  users: MockUserRepository = buildMockUserRepository(),
  semesters: MockSemesterRepository = buildMockSemesterRepository()
): {
  uow: UnitOfWork
  users: MockUserRepository
  semesters: MockSemesterRepository
} {
  const uow: UnitOfWork = {
    execute: async (work) =>
      work({
        users: users as unknown as UserRepository,
        semesters: semesters as unknown as SemesterRepository,
      } as UnitOfWorkContext),
  }
  return { uow, users, semesters }
}
