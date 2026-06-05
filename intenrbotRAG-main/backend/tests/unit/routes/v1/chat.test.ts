import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../../src/api/app'
import { mockTokenVerifier } from '../../../setup'
import { InMemoryApiKeyRepository } from '../../../helpers/inMemoryApiKeyRepository'
import { hashApiKeyPlaintext } from '../../../../src/application/apiKeys/ApiKeyService'

vi.mock('../../../../src/infrastructure/ai/geminiProvider', () => ({
  GeminiModelProvider: class {
    readonly name = 'gemini'
    async generateText() {
      return { rawText: 'FAQ answer' }
    }
  },
}))

vi.mock('../../../../src/infrastructure/retrieval/supabaseKnowledgeRetriever', () => ({
  SupabaseKnowledgeRetriever: class {
    async search() {
      return [
        {
          title: 'FAQ',
          section: 'General',
          text: 'Details here.',
          sourceUrl: 'https://example.com/doc',
        },
      ]
    }
  },
}))

const plaintextKey = `ibk_test_${'b'.repeat(32)}`
const keyHash = hashApiKeyPlaintext(plaintextKey)

describe('POST /api/v1/chat/message', () => {
  beforeEach(() => {
    vi.stubEnv('API_KEY_RATE_LIMIT_PER_MIN', '1000')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns sources for faq-rag', async () => {
    const repo = new InMemoryApiKeyRepository()
    repo.seed({
      keyHash,
      label: 'unit',
      env: 'test',
      platform: 'internbot',
      revoked: false,
      createdAtIso: new Date().toISOString(),
    })
    const app = createApp({ tokenVerifier: mockTokenVerifier, apiKeyRepository: repo })

    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({ feature: 'faq-rag', userInput: 'Question?' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('FAQ answer')
    expect(res.body.sources[0]?.title).toBe('FAQ')
  })

  it('returns 400 for invalid body', async () => {
    const repo = new InMemoryApiKeyRepository()
    repo.seed({
      keyHash,
      label: 'unit',
      env: 'test',
      platform: 'internbot',
      revoked: false,
      createdAtIso: new Date().toISOString(),
    })
    const app = createApp({ tokenVerifier: mockTokenVerifier, apiKeyRepository: repo })

    const res = await request(app)
      .post('/api/v1/chat/message')
      .set('Authorization', `Bearer ${plaintextKey}`)
      .send({ feature: 'faq-rag', userInput: '' })

    expect(res.status).toBe(400)
  })
})

describe('Per-key rate limit', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns 429 after exceeding API_KEY_RATE_LIMIT_PER_MIN', async () => {
    vi.stubEnv('API_KEY_RATE_LIMIT_PER_MIN', '2')

    const repo = new InMemoryApiKeyRepository()
    repo.seed({
      keyHash,
      label: 'unit',
      env: 'test',
      platform: 'internbot',
      revoked: false,
      createdAtIso: new Date().toISOString(),
    })
    const app = createApp({ tokenVerifier: mockTokenVerifier, apiKeyRepository: repo })

    const body = { feature: 'faq-rag' as const, userInput: 'x' }
    const auth = { Authorization: `Bearer ${plaintextKey}` }

    const first = await request(app).post('/api/v1/chat/message').set(auth).send(body)
    const second = await request(app).post('/api/v1/chat/message').set(auth).send(body)
    const third = await request(app).post('/api/v1/chat/message').set(auth).send(body)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(third.status).toBe(429)
  })
})
