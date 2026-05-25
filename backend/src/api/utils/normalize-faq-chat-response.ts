export interface NormalizedChatSource {
  title: string
  section: string
  sourceUrl?: string
  excerpt?: string
}

interface FaqPayload {
  answer: string
  sources?: unknown
}

function dedupeSources(sources: NormalizedChatSource[]): NormalizedChatSource[] {
  const seen = new Set<string>()
  return sources.filter((source) => {
    const key = `${source.title}|${source.section}|${source.sourceUrl ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function parseRetrievalSources(raw: unknown): NormalizedChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: String(item.title ?? ''),
      section: String(item.section ?? ''),
      sourceUrl: typeof item.sourceUrl === 'string' ? item.sourceUrl : undefined,
      excerpt: typeof item.excerpt === 'string' ? item.excerpt : undefined,
    }))
    .filter((item) => item.title && item.section)
}

function parseFaqModelSources(raw: unknown): NormalizedChatSource[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      title: String(item.title ?? ''),
      section: String(item.section ?? ''),
      sourceUrl: typeof item.url === 'string' ? item.url : undefined,
    }))
    .filter((item) => item.title && item.section)
}

function looksLikeMarkdown(text: string): boolean {
  return /(^|\n)\s{0,3}#{1,6}\s|\*\*|(^|\n)\s*[-*]\s|\[[^\]]+\]\([^)]+\)|```/m.test(text)
}

function resolveContentType(text: string): 'plain' | 'markdown' {
  return looksLikeMarkdown(text) ? 'markdown' : 'plain'
}

/**
 * Scan backwards from the last '}' to find its matching '{', then attempt
 * to parse the slice as JSON. Extracts trailing FAQ JSON from model rawText.
 */
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

function parseFaqPayloadFromObject(parsed: unknown): FaqPayload | undefined {
  if (!parsed || typeof parsed !== 'object') return undefined
  const record = parsed as Record<string, unknown>
  if (typeof record.answer !== 'string' || !record.answer.trim()) return undefined
  return { answer: record.answer, sources: record.sources }
}

function resolveFaqPayload(data: Record<string, unknown>): FaqPayload | undefined {
  const structured = data.structuredData as
    | { type: string; data: Record<string, unknown> }
    | undefined

  if (structured?.type === 'faq' && typeof structured.data?.answer === 'string') {
    return { answer: structured.data.answer, sources: structured.data.sources }
  }

  const reply = typeof data.reply === 'string' ? data.reply : ''
  if (!reply) return undefined

  const trimmed = reply.trim()
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const fromJson = parseFaqPayloadFromObject(parsed)
      if (fromJson) return fromJson
    } catch {
      // fall through to trailing JSON extraction
    }
  }

  const trailing = extractJsonFromText(reply)
  return parseFaqPayloadFromObject(trailing)
}

function buildNormalizedResponse(
  data: Record<string, unknown>,
  faq: FaqPayload
): Record<string, unknown> {
  const retrievalSources = parseRetrievalSources(data.sources)
  const modelSources = parseFaqModelSources(faq.sources)

  return {
    ...data,
    reply: faq.answer,
    contentType: resolveContentType(faq.answer),
    contentBlocks: undefined,
    structuredData: undefined,
    sources: dedupeSources([...retrievalSources, ...modelSources]),
    webSources: data.webSources,
  }
}

/**
 * Flattens interbotRAG FAQ structured responses for Internbot chat clients while
 * preserving retrieved knowledge sources (with excerpts) and model-cited sources.
 */
export function normalizeFaqChatResponse(data: Record<string, unknown>): Record<string, unknown> {
  const faq = resolveFaqPayload(data)
  if (!faq) return data
  return buildNormalizedResponse(data, faq)
}
