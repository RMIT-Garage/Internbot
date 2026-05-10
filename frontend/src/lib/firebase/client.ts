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

// The frontend talks to Firebase Auth and the backend API only. It does
// NOT load `firebase/firestore` or `firebase/storage` — domain reads and
// writes go through `apiFetch` (see docs/FRONTEND.md).
const firebaseApp: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

export const app: FirebaseApp = firebaseApp
export const auth: Auth = getAuth(firebaseApp)

if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' && typeof window !== 'undefined') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  } catch {
    // Already connected (React strict mode double-invoke)
  }
}
