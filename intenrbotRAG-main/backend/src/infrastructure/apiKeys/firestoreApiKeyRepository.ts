import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../config/firebaseAdmin'
import type { ApiKeyRecord, ApiKeyRepository } from '../../application/ports/apiKeyRepository'
import { API_KEY_COLLECTION } from '../../application/apiKeys/types'

export class FirestoreApiKeyRepository implements ApiKeyRepository {
  async getByKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
    const snap = await adminDb.collection(API_KEY_COLLECTION).doc(keyHash).get()
    if (!snap.exists) return null
    const data = snap.data() as FirestoreApiKeyDoc | undefined
    if (!data) return null
    return firestoreToRecord(keyHash, data)
  }

  async create(record: ApiKeyRecord): Promise<void> {
    const ref = adminDb.collection(API_KEY_COLLECTION).doc(record.keyHash)
    const snap = await ref.get()
    if (snap.exists) {
      throw new Error(`API key document already exists for hash ${record.keyHash.slice(0, 8)}…`)
    }
    await ref.set({
      label: record.label,
      env: record.env,
      platform: record.platform,
      revoked: record.revoked,
      createdAt: FieldValue.serverTimestamp(),
      createdAtIso: record.createdAtIso,
    })
  }

  async setRevoked(keyHash: string, revoked: boolean): Promise<void> {
    await adminDb.collection(API_KEY_COLLECTION).doc(keyHash).update({ revoked })
  }
}

interface FirestoreApiKeyDoc {
  label: string
  env: string
  platform: string
  revoked: boolean
  createdAtIso?: string
}

function firestoreToRecord(keyHash: string, data: FirestoreApiKeyDoc): ApiKeyRecord {
  const env = data.env === 'live' || data.env === 'test' ? data.env : 'live'
  return {
    keyHash,
    label: data.label,
    env,
    platform: data.platform,
    revoked: Boolean(data.revoked),
    createdAtIso: data.createdAtIso ?? '',
  }
}
