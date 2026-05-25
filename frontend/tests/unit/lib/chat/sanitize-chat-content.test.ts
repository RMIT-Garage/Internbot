import { describe, expect, it } from 'vitest'
import { sanitizeChatContent } from '@/lib/chat/sanitize-chat-content'

describe('sanitizeChatContent', () => {
  it('extracts FAQ answer from trailing JSON in reply', () => {
    const answer = 'Coordinators:\n\n* Alessio Bonti'
    const reply = `Reasoning text.\n\n${JSON.stringify({
      answer,
      sources: [],
      confidence: 0.9,
      answered_from_context: true,
    })}`

    const result = sanitizeChatContent(reply, 'plain')

    expect(result.content).toBe(answer)
    expect(result.contentType).toBe('markdown')
    expect(result.extractedFaq).toBe(true)
    expect(result.content).not.toContain('answered_from_context')
  })

  it('extracts FAQ answer from pure JSON reply', () => {
    const answer = 'You need 48 credit points.'
    const reply = JSON.stringify({
      answer,
      sources: [],
      confidence: 0.9,
      answered_from_context: true,
    })

    const result = sanitizeChatContent(reply)

    expect(result.content).toBe(answer)
    expect(result.contentType).toBe('plain')
    expect(result.extractedFaq).toBe(true)
  })

  it('detects markdown in plain server contentType', () => {
    const content = '* **Duration**: 40 weeks minimum.'
    const result = sanitizeChatContent(content, 'plain')

    expect(result.content).toBe(content)
    expect(result.contentType).toBe('markdown')
    expect(result.extractedFaq).toBe(false)
  })

  it('preserves server markdown contentType', () => {
    const content = 'Already formatted.'
    const result = sanitizeChatContent(content, 'markdown')

    expect(result.contentType).toBe('markdown')
  })
})
