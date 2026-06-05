import type { ApiKeyRecord, ApiKeyRepository } from '../../src/application/ports/apiKeyRepository'

export class InMemoryApiKeyRepository implements ApiKeyRepository {
  private readonly store = new Map<string, ApiKeyRecord>()

  async getByKeyHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return this.store.get(keyHash) ?? null
  }

  async create(record: ApiKeyRecord): Promise<void> {
    if (this.store.has(record.keyHash)) {
      throw new Error('duplicate key')
    }
    this.store.set(record.keyHash, { ...record })
  }

  async setRevoked(keyHash: string, revoked: boolean): Promise<void> {
    const existing = this.store.get(keyHash)
    if (!existing) return
    this.store.set(keyHash, { ...existing, revoked })
  }

  /** Test helper: insert a record as if issued */
  seed(record: ApiKeyRecord): void {
    this.store.set(record.keyHash, { ...record })
  }
}
