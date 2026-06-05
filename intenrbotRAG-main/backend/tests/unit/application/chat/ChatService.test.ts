import { describe, expect, it, vi } from 'vitest'
import { ChatService } from '../../../../src/application/chat/ChatService'
import type { KnowledgeRetriever } from '../../../../src/application/ports/knowledgeRetriever'
import type { ModelProvider } from '../../../../src/application/ports/modelProvider'

const modelProvider: ModelProvider = {
  name: 'test-provider',
  generateText: vi.fn().mockResolvedValue({ rawText: 'Grounded answer' }),
}

const knowledgeRetriever: KnowledgeRetriever = {
  search: vi.fn().mockResolvedValue([
    {
      title: 'Internship FAQ',
      section: 'Eligibility',
      text: 'Students must be enrolled full-time.',
      sourceUrl: 'https://example.com/faq',
    },
  ]),
}

describe('ChatService', () => {
  it('returns reply and sources from retrieved chunks', async () => {
    const service = new ChatService({ provider: modelProvider, knowledgeRetriever })

    const result = await service.generateResponse('faq-rag', 'Who can apply?')

    expect(result.reply).toBe('Grounded answer')
    expect(result.sources).toEqual([
      {
        title: 'Internship FAQ',
        section: 'Eligibility',
        sourceUrl: 'https://example.com/faq',
        excerpt: 'Students must be enrolled full-time.',
      },
    ])
    expect(vi.mocked(modelProvider.generateText)).toHaveBeenCalledOnce()
  })
})
