import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../../../src/api/app'
import { mockActor, mockTokenVerifier } from '../../setup'

vi.mock('../../../src/infrastructure/retrieval/supabaseKnowledgeRepository', () => ({
  SupabaseKnowledgeRepository: class {
    async createDocument() {
      return {
        id: 'doc-1',
        feature: 'faq-rag',
        title: 'Internship FAQ',
        section: 'Eligibility',
        status: 'ready',
        createdAt: '2026-04-21T00:00:00.000Z',
      }
    }

    async createChunks() {}

    async listDocuments() {
      return [
        {
          id: 'doc-1',
          feature: 'faq-rag',
          title: 'Internship FAQ',
          section: 'Eligibility',
          status: 'ready',
          createdAt: '2026-04-21T00:00:00.000Z',
        },
      ]
    }

    async deleteDocumentsByFeature() {
      return 0
    }
  },
}))

vi.mock('../../../src/infrastructure/ai/geminiEmbeddingProvider', () => ({
  GeminiEmbeddingProvider: class {
    async embed() {
      return Array.from({ length: 768 }, () => 0.1)
    }
  },
}))

const app = createApp({ tokenVerifier: mockTokenVerifier })

describe('knowledge routes', () => {
  it('rejects non-admin users', async () => {
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue(mockActor)

    const res = await request(app)
      .post('/api/knowledge/documents')
      .set('Authorization', 'Bearer valid-token')
      .send({
        feature: 'faq-rag',
        title: 'Internship FAQ',
        section: 'Eligibility',
        content: 'Students must be enrolled full-time.',
      })

    expect(res.status).toBe(403)
  })

  it('allows admins to create a knowledge document', async () => {
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue({
      ...mockActor,
      claims: { admin: true },
    })

    const res = await request(app)
      .post('/api/knowledge/documents')
      .set('Authorization', 'Bearer valid-token')
      .send({
        feature: 'faq-rag',
        title: 'Internship FAQ',
        section: 'Eligibility',
        content: 'Students must be enrolled full-time.',
      })

    expect(res.status).toBe(201)
    expect(res.body.document.title).toBe('Internship FAQ')
  })

  it('lists documents for admins', async () => {
    vi.mocked(mockTokenVerifier.verify).mockResolvedValue({
      ...mockActor,
      claims: { admin: true },
    })

    const res = await request(app)
      .get('/api/knowledge/documents')
      .set('Authorization', 'Bearer valid-token')

    expect(res.status).toBe(200)
    expect(res.body.documents).toHaveLength(1)
  })
})
