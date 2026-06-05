import type { ApiKeyEnv } from '../ports/apiKeyRepository'

export const API_KEY_COLLECTION = 'api_keys'

/** Plaintext key shape: ibk_{live|test}_{32 hex secret} */
export const API_KEY_PREFIX = 'ibk_'

export interface IssuedApiKey {
  plaintext: string
  keyHash: string
  label: string
  env: ApiKeyEnv
  platform: string
  createdAtIso: string
}
