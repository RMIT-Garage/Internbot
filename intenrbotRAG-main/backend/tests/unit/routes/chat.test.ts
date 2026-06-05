import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { mockActor, mockTokenVerifier } from '../../setup'

vi.mock('../../../src/infrastructure/ai/geminiProvider', () => ({
  GeminiModelProvider: class {
    readonly name = 'gemini'
    async generateText() {
      return { rawText: 'Chat reply' }
    }
  },
}))

vi.mock('../../../src/infrastructure/retrieval/supabaseKnowledgeRetriever', () => ({
  SupabaseKnowledgeRetriever: class {
    async search() {
      return [
        {
          title: 'Internship FAQ',
          section: 'Eligibility',
          text: 'Students must be enrolled full-time.',
          sourceUrl: 'https://example.com/faq',
        },
      ]
    }
  },
}))

const app = createApp({ tokenVerifier: mockTokenVerifier })

describe('POST /api/chat/message', () => {
  it('returns reply and sources for authenticated users', async () => {
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)

    const res = await request(app)
      .post('/api/chat/message')
      .set('Authorization', 'Bearer valid-token')
      .send({ feature: 'faq-rag', userInput: 'Who can apply?' })

    expect(res.status).toBe(200)
    expect(res.body.reply).toBe('Chat reply')
    expect(res.body.sources).toEqual([
      {
        title: 'Internship FAQ',
        section: 'Eligibility',
        sourceUrl: 'https://example.com/faq',
        excerpt: 'Students must be enrolled full-time.',
      },
    ])
  })

  it('returns 400 for invalid payloads', async () => {
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)

    const res = await request(app)
      .post('/api/chat/message')
      .set('Authorization', 'Bearer valid-token')
      .send({ feature: 'faq-rag', userInput: '' })

    expect(res.status).toBe(400)
  })
})
