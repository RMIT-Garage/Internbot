import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Defer init until first property access. Eager `getAuth(app)` was tried but
// breaks the CI static-export prerender of `_not-found`: NEXT_PUBLIC_FIREBASE_*
// env vars aren't set during the CI sanity build, and Auth validates `apiKey`
// at construction. The deploy workflow does inject the secrets, so the bundle
// that actually ships always sees real values on first browser access.
//
// A previous lazy-proxy version also wrapped Firestore and broke
// `instanceof CollectionReference` inside the Firestore SDK. The frontend no
// longer loads Firestore (see docs/FRONTEND.md); the Auth SDK identifies its
// singleton via `auth.app.name`, not class identity, so a Proxy is safe.
let _app: FirebaseApp | undefined
let _auth: Auth | undefined

function getApp_(): FirebaseApp {
  if (!_app) {
    _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  }
  return _app
}

function getAuth_(): Auth {
  if (!_auth) {
    _auth = getAuth(getApp_())
    if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && typeof window !== 'undefined') {
      try {
        connectAuthEmulator(_auth, 'http://localhost:9099', { disableWarnings: true })
      } catch {
        // Already connected (React strict mode double-invoke)
      }
    }
  }
  return _auth
}

function lazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const target = factory() as unknown as Record<string | symbol, unknown>
      const value = target[prop]
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(target)
        : value
    },
    set(_, prop, value) {
      const target = factory() as unknown as Record<string | symbol, unknown>
      target[prop] = value
      return true
    },
  })
}

export const app: FirebaseApp = lazyProxy(getApp_)
export const auth: Auth = lazyProxy(getAuth_)
