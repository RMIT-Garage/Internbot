import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'
import { readFileSync } from 'node:fs'

function useEmulatorAdmin(): boolean {
  // USE_EMULATOR: local Express / scripts. FUNCTIONS_EMULATOR: Firebase Functions emulator worker
  // (Docker Compose env_file is not always visible to the Functions analyzer subprocess.)
  return process.env.USE_EMULATOR === 'true' || process.env.FUNCTIONS_EMULATOR === 'true'
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!

  if (useEmulatorAdmin()) {
    return initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project' })
  }

  const encodedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_BASE64
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  let serviceAccountJson: string | null = null
  if (encodedKey) {
    serviceAccountJson = Buffer.from(encodedKey, 'base64').toString('utf8')
  } else if (credentialsPath) {
    serviceAccountJson = readFileSync(credentialsPath, 'utf8')
  }

  if (!serviceAccountJson) {
    // Fall back to application default credentials so Firebase Functions source analysis
    // and runtime environments can initialize Admin SDK without requiring custom env vars.
    return initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT,
    })
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccountJson)),
    projectId: process.env.FIREBASE_PROJECT_ID,
  })
}

export const adminApp = getAdminApp()
export const adminAuth = getAuth(adminApp)
export const adminDb = getFirestore(adminApp)
export const adminStorage = getStorage(adminApp)
