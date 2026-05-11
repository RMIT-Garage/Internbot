import { getApps, initializeApp, deleteApp, type App } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth, type Auth } from 'firebase-admin/auth'

/**
 * Shared test setup for integration + component tiers.
 *
 * Hard rule: these tiers use ZERO mocks. All collaborators (Firestore, Firebase
 * Auth, repositories, UoW, claims service, token verifier) run against the
 * real Firebase emulators. The only role of this module is:
 *   - Boot the Admin SDK against the emulator exactly once per worker
 *   - Provide per-test isolation helpers (random IDs + tracked cleanup)
 *   - Mint real emulator ID tokens so component tests can exercise the full
 *     auth middleware
 *
 * Prerequisites: `pnpm run emulator` must be running
 *   - Firestore → localhost:8080
 *   - Firebase Auth → localhost:9099
 */

const EMULATOR_PROJECT_ID = process.env['FIREBASE_PROJECT_ID'] ?? 'demo-internbot'
const FIRESTORE_HOST = process.env['FIRESTORE_EMULATOR_HOST'] ?? 'localhost:8080'
const AUTH_HOST = process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? 'localhost:9099'

/**
 * Sentinels for date-window fixtures in integration + component tests.
 *
 * Emulator-backed tests can't use vitest's fake timers (the emulator runs
 * out-of-process and stamps its own server-side timestamps), so we hard-code
 * "always open" / "always closed" windows instead. Picking dates close to
 * "now" silently expires tests months later — `2026-01-01 → 2027-01-01` was
 * the previous pattern and would have started failing on 2027-01-01.
 *
 * Use these constants for any window-state fixture that should be
 * unconditionally open or closed regardless of when the test runs.
 */
export const ALWAYS_OPEN_WINDOW = {
  open: new Date('2000-01-01T00:00:00Z'),
  close: new Date('2099-12-31T23:59:59Z'),
} as const

export const ALWAYS_CLOSED_WINDOW = {
  open: new Date('2000-01-01T00:00:00Z'),
  close: new Date('2000-12-31T23:59:59Z'),
} as const

let initialized = false
let testApp: App | undefined
let testDb: Firestore | undefined
let testAuth: Auth | undefined
const trackedDocs = new Map<string, Set<string>>()
const trackedAuthUsers = new Set<string>()

/**
 * Boot the Admin SDK against the emulators exactly once per process.
 * Call from `beforeAll`. Idempotent.
 */
export function initEmulator(): void {
  if (initialized) return
  process.env['FIRESTORE_EMULATOR_HOST'] = FIRESTORE_HOST
  process.env['FIREBASE_AUTH_EMULATOR_HOST'] = AUTH_HOST
  process.env['FIREBASE_PROJECT_ID'] = EMULATOR_PROJECT_ID
  process.env['USE_EMULATOR'] = 'true'
  process.env['GCLOUD_PROJECT'] = EMULATOR_PROJECT_ID

  testApp = getApps()[0] ?? initializeApp({ projectId: EMULATOR_PROJECT_ID })
  testDb = getFirestore(testApp)
  testAuth = getAuth(testApp)
  initialized = true
}

function requireDb(): Firestore {
  if (!testDb) throw new Error('initEmulator() must be called before using emulator helpers')
  return testDb
}

function requireAuth(): Auth {
  if (!testAuth) throw new Error('initEmulator() must be called before using emulator helpers')
  return testAuth
}

// ---------------------------- doc tracking -----------------------------

export function trackDoc(collection: string, id: string): void {
  const set = trackedDocs.get(collection) ?? new Set<string>()
  set.add(id)
  trackedDocs.set(collection, set)
}

/**
 * Delete every doc tracked by `trackDoc()` and reset the tracking map.
 *
 * IMPORTANT — does NOT wipe collections wholesale. Earlier versions did,
 * for sibling guard collections (`userIdentities`, `semesterNaturalKeys`),
 * to "prevent accumulation across the suite". That wholesale wipe raced
 * with sibling test files: file A's `afterEach` would scan the whole
 * collection while file B was mid-operation, deleting B's in-flight guard
 * doc and producing inconsistent failures (duplicate-create no longer
 * 409s, identity lookups returning undefined, etc).
 *
 * Test isolation is provided by random ids (`crypto.randomUUID()`) at the
 * call sites — collisions across tests / runs are not possible. Guard
 * docs left behind in the emulator are harmless: the emulator drops all
 * data when its process exits. Tests that *do* care about a specific
 * guard's lifecycle should `trackDoc('userIdentities', deterministicId)`
 * (or `'semesterNaturalKeys'`) directly so the cleanup is scoped to
 * THIS test only.
 */
export async function clearDocs(): Promise<void> {
  const db = requireDb()
  const deletions: Promise<unknown>[] = []
  for (const [collection, ids] of trackedDocs.entries()) {
    for (const id of ids) {
      deletions.push(
        db
          .collection(collection)
          .doc(id)
          .delete()
          .catch(() => undefined)
      )
    }
  }
  trackedDocs.clear()
  await Promise.all(deletions)
}

// -------------------------- auth user helpers --------------------------

export function trackAuthUser(uid: string): void {
  trackedAuthUsers.add(uid)
}

export async function clearAuthUsers(): Promise<void> {
  const auth = requireAuth()
  const uids = [...trackedAuthUsers]
  trackedAuthUsers.clear()
  await Promise.all(uids.map((uid) => auth.deleteUser(uid).catch(() => undefined)))
}

/**
 * Idempotent Firebase Auth user creation in the emulator. Tracks the uid for
 * cleanup in `clearAuthUsers()`.
 *
 * Always provisions with `emailVerified: true` so the resulting ID token
 * passes the production `email_verified === true` gate (enforced by both the
 * `enforceVerifiedEmail` blocking function and the backend token verifier).
 * Tests that want to exercise the unverified path should call
 * `auth.updateUser(uid, { emailVerified: false })` explicitly after this
 * helper returns.
 */
export async function ensureFirebaseUser(uid: string, email?: string): Promise<void> {
  const auth = requireAuth()
  try {
    const existing = await auth.getUser(uid)
    if (!existing.emailVerified) {
      await auth.updateUser(uid, { emailVerified: true })
    }
  } catch {
    await auth.createUser({
      uid,
      ...(email ? { email } : {}),
      emailVerified: true,
    })
  }
  trackAuthUser(uid)
}

/**
 * Mint a real ID token via the Firebase Auth emulator. The emulator exchanges
 * a custom token for an ID token that `adminAuth.verifyIdToken` will accept,
 * so component tests can run the full auth middleware path without stubs.
 */
export async function mintEmulatorIdToken(uid: string, email?: string): Promise<string> {
  await ensureFirebaseUser(uid, email)
  const auth = requireAuth()
  const customToken = await auth.createCustomToken(uid)

  const res = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  )
  if (!res.ok) {
    throw new Error(`Emulator token exchange failed (${res.status}): ${await res.text()}`)
  }
  const body = (await res.json()) as { idToken?: string }
  if (!body.idToken) throw new Error('Emulator token exchange returned no idToken')
  return body.idToken
}

export async function tearDownEmulator(): Promise<void> {
  if (testApp) {
    await deleteApp(testApp).catch(() => undefined)
    testApp = undefined
    testDb = undefined
    testAuth = undefined
    initialized = false
  }
}
