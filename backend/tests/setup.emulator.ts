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
 * `setCustomUserClaims` (called by `FirebasePlatformClaimsService`) requires
 * the user to exist — call this before invoking a command handler that sets
 * claims, or before issuing a component-test request that will trigger such a
 * handler.
 */
export async function ensureFirebaseUser(uid: string, email?: string): Promise<void> {
  const auth = requireAuth()
  try {
    await auth.getUser(uid)
  } catch {
    await auth.createUser({ uid, ...(email ? { email } : {}) })
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
