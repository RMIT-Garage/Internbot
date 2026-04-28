import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  // Local emulator — no real credentials needed.
  if (process.env.USE_EMULATOR === 'true') {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project' })
  }

  // Optional SA key path for running outside GCP (e.g. local dev against real Firebase).
  const encodedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  if (encodedKey) {
    return initializeApp({
      credential: cert(JSON.parse(Buffer.from(encodedKey, 'base64').toString('utf8'))),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  }

  // Deployed Cloud Functions / GCE / Cloud Run — ADC injected by runtime.
  // Project ID is also auto-detected from GOOGLE_CLOUD_PROJECT.
  return initializeApp({ credential: applicationDefault() })
}

export const adminApp = getAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
export const adminStorage = getStorage(adminApp)

// Re-export Firestore value helpers so api/routes/ does not import firebase-admin
// directly (enforced by tests/unit/architecture/architecture.test.ts).
export { FieldValue, Timestamp } from 'firebase-admin/firestore'
export type {
  DocumentSnapshot,
  QueryDocumentSnapshot,
  Query,
  CollectionReference,
  DocumentReference,
} from 'firebase-admin/firestore'
