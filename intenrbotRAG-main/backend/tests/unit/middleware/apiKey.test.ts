import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { mockTokenVerifier } from '../../setup'
import { InMemoryApiKeyRepository } from '../../helpers/inMemoryApiKeyRepository'
import { hashApiKeyPlaintext } from '../../../src/application/apiKeys/ApiKeyService'

vi.mock('../../../src/infrastructure/ai/geminiProvider', () => ({
  GeminiModelProvider: class {
    readonly name = 'gemini'
    async generateText() {
      return { rawText: 'v1 reply' }
    }
  },
}))

vi.mock('../../../src/infrastructure/retrieval/supabaseKnowledgeRetriever', () => ({
  SupabaseKnowledgeRetriever: class {
    async search() {
      return []
    }
  },
}))

const plaintextKey = `ibk_test_${'a'.repeat(32)}`
const keyHash = hashApiKeyPlaintext(plaintextKey)

function createTestApp() {
  const repo = new InMemoryApiKeyRepository()
  repo.seed({
    keyHash,
    label: 'test',
    env: 'test',
    platform: 'internbot',
    revoked: false,
    createdAtIso: new Date().toISOString(),
  })
  return { app: createApp({ tokenVerifier: mockTokenVerifier, apiKeyRepository: repo }), repo }
}

describe('API key middleware (v1)', () => {
  it('returns 401 without Authorization for v1 chat', async () => {
    const { app } = createTestApp()
    const res = await request(app)
      .post('/api/v1/chat/message')
      .send({ feature: 'faq-rag', userInput: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for legacy demo bypass token no-token on v1', async () => {
    const { app } = createTestApp()
    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', 'Bearer no-token')
      .send({ feature: 'faq-rag', userInput: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 401 for malformed API key', async () => {
    const { app } = createTestApp()
    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', 'Bearer not-a-real-key')
      .send({ feature: 'faq-rag', userInput: 'hi' })
    expect(res.status).toBe(401)
  })

  it('returns 200 with valid API key', async () => {
    const { app } = createTestApp()
    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({ feature: 'faq-rag', userInput: 'hi' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('v1 reply')
  })

  it('returns 403 when key is revoked', async () => {
    const { app, repo } = createTestApp()
    await repo.setRevoked(keyHash, true)

    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({ feature: 'faq-rag', userInput: 'hi' })

    expect(res.status).toBe(403)
  })

  it('GET /api/v1/health does not require API key', async () => {
    const { app } = createTestApp()
    const res = await request(app).get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
