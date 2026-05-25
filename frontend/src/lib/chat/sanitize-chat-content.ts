export type ChatContentType = 'plain' | 'markdown' | 'structured'

export interface SanitizedChatContent {
  content: string
  contentType: 'plain' | 'markdown'
  /** True when FAQ JSON was extracted from the reply (contentBlocks should be ignored). */
  extractedFaq: boolean
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|\*\*|(^|\n)\s*[-*]\s|\[[^\]]+\]\([^)]+\)|```/m.test(text)
}

function resolveContentType(text: string): 'plain' | 'markdown' {
  return looksLikeMarkdown(text) ? 'markdown' : 'plain'
}

function extractJsonFromText(text: string): unknown | null {
  const lastBrace = text.lastIndexOf('}')
  if (lastBrace === -1) return null

  let depth = 0
  for (let i = lastBrace; i >= 0; i--) {
    if (text[i] === '}') depth++
    else if (text[i] === '{') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(i, lastBrace + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function parseFaqAnswer(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  const answer = (parsed as Record<string, unknown>).answer
  return typeof answer === 'string' && answer.trim() ? answer : undefined
}

function extractFaqAnswerFromReply(reply: string): string | undefined {
  const trimmed = reply.trim()
  if (!trimmed) return undefined

  if (trimmed.startsWith('{')) {
    try {
      const fromWhole = parseFaqAnswer(JSON.parse(trimmed))
      if (fromWhole) return fromWhole
    } catch {
      // fall through
    }
  }

  return parseFaqAnswer(extractJsonFromText(reply))
}

/**
 * Client-side cleanup for interbotRAG FAQ replies (defense in depth when proxy normalization
 * is missing or the client has a cached raw response).
 */
export function sanitizeChatContent(
  reply: string,
  serverContentType?: ChatContentType
): SanitizedChatContent {
  const faqAnswer = extractFaqAnswerFromReply(reply)
  if (faqAnswer) {
    return {
      content: faqAnswer,
      contentType: resolveContentType(faqAnswer),
      extractedFaq: true,
    }
  }

  const content = reply
  if (serverContentType === 'markdown') {
    return { content, contentType: 'markdown', extractedFaq: false }
  }
  if (serverContentType === 'structured' && looksLikeMarkdown(content)) {
    return { content, contentType: 'markdown', extractedFaq: false }
  }

  return {
    content,
    contentType: resolveContentType(content),
    extractedFaq: false,
  }
}
