export interface NormalizedChatSource {
  title: string
  section: string
  sourceUrl?: string
  excerpt?: string
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

/**
 * Flattens interbotRAG FAQ structured responses for Internbot chat clients while
 * preserving retrieved knowledge sources (with excerpts) and model-cited sources.
 */
export function normalizeFaqChatResponse(data: Record<string, unknown>): Record<string, unknown> {
  const structured = data.structuredData as
    | { type: string; data: Record<string, unknown> }
    | undefined

  if (structured?.type !== 'faq' || typeof structured.data?.answer !== 'string') {
    return data
  }

  const retrievalSources = parseRetrievalSources(data.sources)
  const modelSources = parseFaqModelSources(structured.data.sources)

  return {
    ...data,
    reply: structured.data.answer,
    contentType: 'plain',
    contentBlocks: undefined,
    structuredData: undefined,
    sources: dedupeSources([...retrievalSources, ...modelSources]),
    webSources: data.webSources,
  }
}
