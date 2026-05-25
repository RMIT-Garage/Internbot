import { describe, expect, it } from 'vitest'
import { normalizeFaqChatResponse } from '../../../../src/api/utils/normalize-faq-chat-response'

describe('normalizeFaqChatResponse', () => {
  it('returns data unchanged when response is not FAQ structured', () => {
    const data = {
      reply: 'plain reply',
      sources: [{ title: 'Policy', section: 'A', sourceUrl: 'https://example.com' }],
    }
    expect(normalizeFaqChatResponse(data)).toEqual(data)
  })

  it('flattens FAQ answer and preserves retrieval sources with excerpts', () => {
    const data = {
      reply: '{"answer":"ignored"}',
      structuredData: {
        type: 'faq',
        data: {
          answer: 'Internships run for one semester.',
          sources: [
            {
              title: 'Internship FAQ',
              section: 'Duration',
              url: 'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
            },
          ],
          confidence: 0.9,
          answered_from_context: true,
        },
      },
      sources: [
        {
          title: 'Internship FAQ for Students',
          section: '2. Internship Duration',
          sourceUrl:
            'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
          excerpt: 'The internship is undertaken over one teaching period.',
        },
      ],
      webSources: [{ title: 'RMIT WIL', uri: 'https://www.rmit.edu.au/wil' }],
    }

    const normalized = normalizeFaqChatResponse(data)

    expect(normalized.reply).toBe('Internships run for one semester.')
    expect(normalized.contentType).toBe('plain')
    expect(normalized.structuredData).toBeUndefined()
    expect(normalized.sources).toEqual([
      {
        title: 'Internship FAQ for Students',
        section: '2. Internship Duration',
        sourceUrl:
          'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
        excerpt: 'The internship is undertaken over one teaching period.',
      },
      {
        title: 'Internship FAQ',
        section: 'Duration',
        sourceUrl:
          'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil',
      },
    ])
    expect(normalized.webSources).toEqual(data.webSources)
  })

  it('dedupes retrieval and model sources that match title, section, and url', () => {
    const url =
      'https://www.rmit.edu.au/students/careers-opportunities/internships-work-experience-wil'
    const data = {
      reply: '{}',
      structuredData: {
        type: 'faq',
        data: {
          answer: 'Yes.',
          sources: [{ title: 'FAQ', section: 'Eligibility', url }],
          confidence: 1,
          answered_from_context: true,
        },
      },
      sources: [{ title: 'FAQ', section: 'Eligibility', sourceUrl: url, excerpt: 'Need 48 CP.' }],
    }

    const normalized = normalizeFaqChatResponse(data)
    expect(normalized.sources).toHaveLength(1)
    expect((normalized.sources as Array<{ excerpt?: string }>)[0]?.excerpt).toBe('Need 48 CP.')
  })
})
