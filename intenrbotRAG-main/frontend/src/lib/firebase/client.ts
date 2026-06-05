import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app'
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore'
import { getStorage, connectStorageEmulator, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

type Services = { app: FirebaseApp; auth: Auth; db: Firestore; storage: FirebaseStorage }

let _services: Services | undefined

/**
 * Lazily initializes the Firebase client SDK on first use.
 * Deferred to prevent `auth/invalid-api-key` during `next build` when
 * NEXT_PUBLIC_FIREBASE_* env vars are not set in the CI environment.
 */
function getServices(): Services {
  if (_services) return _services

  const missing = [
    !process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() && 'NEXT_PUBLIC_FIREBASE_API_KEY',
    !process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() && 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() && 'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    !process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() &&
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    !process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() &&
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    !process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() && 'NEXT_PUBLIC_FIREBASE_APP_ID',
  ].filter(Boolean) as string[]

  if (missing.length > 0) {
    throw new Error(
      `Firebase web config is incomplete (missing: ${missing.join(', ')}). ` +
        'In Firebase Console → Project settings → Your apps, open or add a web app and copy ' +
        'the config into frontend/.env.local. See README.md (environment variables). ' +
        'Emulator mode still requires these values.'
    )
  }

  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
  const auth = getAuth(app)
  const db = getFirestore(app)
  const storage = getStorage(app)

  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && typeof window !== 'undefined') {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
      connectFirestoreEmulator(db, 'localhost', 8080)
      connectStorageEmulator(storage, 'localhost', 9199)
    } catch {
      // Already connected (React strict mode double-invoke)
    }
  }

  _services = { app, auth, db, storage }
  return _services
}

const services = getServices()

export const app: FirebaseApp = services.app
export const auth: Auth = services.auth
export const db: Firestore = services.db
export const storage: FirebaseStorage = services.storage
