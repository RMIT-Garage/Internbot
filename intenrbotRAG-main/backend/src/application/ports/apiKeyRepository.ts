export type ApiKeyEnv = 'live' | 'test'

/** Stored record for a hashed API key (document id = keyHash) */
export interface ApiKeyRecord {
  keyHash: string
  label: string
  env: ApiKeyEnv
  platform: string
  revoked: boolean
  createdAtIso: string
}

export interface ApiKeyRepository {
  getByKeyHash(keyHash: string): Promise<ApiKeyRecord | null>
  create(record: ApiKeyRecord): Promise<void>
  setRevoked(keyHash: string, revoked: boolean): Promise<void>
}
