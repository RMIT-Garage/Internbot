import { createHash, randomBytes } from 'node:crypto'
import type { ApiKeyEnv, ApiKeyRecord, ApiKeyRepository } from '../ports/apiKeyRepository'
import { API_KEY_PREFIX } from './types'

export function hashApiKeyPlaintext(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex')
}

export function parseApiKeyPlaintext(token: string): { env: ApiKeyEnv; secretHex: string } | null {
  const trimmed = token.trim()
  const match = /^ibk_(live|test)_([a-f0-9]{32})$/i.exec(trimmed)
  if (!match) return null
  const env = match[1]!.toLowerCase() as ApiKeyEnv
  if (env !== 'live' && env !== 'test') return null
  return { env, secretHex: match[2]!.toLowerCase() }
}

export function generateApiKeyPlaintext(env: ApiKeyEnv): string {
  const secret = randomBytes(16).toString('hex')
  return `${API_KEY_PREFIX}${env}_${secret}`
}

export class ApiKeyService {
  constructor(private readonly repository: ApiKeyRepository) {}

  async issue(options: { label: string; env: ApiKeyEnv; platform?: string }): Promise<{
    plaintext: string
    record: ApiKeyRecord
  }> {
    const plaintext = generateApiKeyPlaintext(options.env)
    const keyHash = hashApiKeyPlaintext(plaintext)
    const createdAtIso = new Date().toISOString()
    const record: ApiKeyRecord = {
      keyHash,
      label: options.label,
      env: options.env,
      platform: options.platform ?? 'internbot',
      revoked: false,
      createdAtIso,
    }
    await this.repository.create(record)
    return { plaintext, record }
  }

  async revoke(keyHash: string): Promise<void> {
    await this.repository.setRevoked(keyHash, true)
  }

  /**
   * Looks up a key by hash. Returns the record if it exists (including revoked keys)
   * so callers can distinguish unknown keys (401) from revoked keys (403).
   */
  async verifyByPlaintext(plaintext: string): Promise<ApiKeyRecord | null> {
    const parsed = parseApiKeyPlaintext(plaintext)
    if (!parsed) return null
    const keyHash = hashApiKeyPlaintext(plaintext.trim())
    const record = await this.repository.getByKeyHash(keyHash)
    if (!record) return null
    return record
  }
}
