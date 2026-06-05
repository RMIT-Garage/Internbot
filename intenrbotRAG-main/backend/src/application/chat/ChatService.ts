import {
  checkerModelOutputSchema,
  faqModelOutputSchema,
  type BenchmarkFeature,
  type CheckerModelOutput,
  type FaqModelOutput,
} from '../benchmark/types'
import type { KnowledgeRetriever, RetrievedKnowledgeChunk } from '../ports/knowledgeRetriever'
import type { ModelProvider } from '../ports/modelProvider'
import { getPromptMaterial } from '../prompts/registry'

interface ChatServiceOptions {
  provider: ModelProvider
  knowledgeRetriever: KnowledgeRetriever
}

export type StructuredChatData =
  | { type: 'checker'; data: CheckerModelOutput }
  | { type: 'faq'; data: FaqModelOutput }

export interface ChatResponse {
  reply: string
  feature: BenchmarkFeature
  structuredData?: StructuredChatData
  contentType?: 'plain' | 'markdown' | 'structured'
  contentVersion?: 'v1'
  contentBlocks?: Array<
    | { type: 'text'; text: string }
    | { type: 'markdown'; text: string }
    | { type: 'citation'; label: string; url?: string }
  >
  sources: Array<{
    title: string
    section: string
    sourceUrl?: string
    excerpt?: string
  }>
  webSources?: Array<{
    title: string
    uri: string
  }>
  debug?: {
    webSearch: {
      requested: boolean
      attempted: boolean
      used: boolean
      sourceCount: number
      fallbackTriggered: boolean
    }
  }
}

export class ChatService {
  private readonly provider: ModelProvider
  private readonly knowledgeRetriever: KnowledgeRetriever

  constructor(options: ChatServiceOptions) {
    this.provider = options.provider
    this.knowledgeRetriever = options.knowledgeRetriever
  }

  async generateResponse(
    feature: BenchmarkFeature,
    userInput: string,
    fileContext?: string,
    attachment?: {
      mimeType: string
      dataBase64: string
      fileName?: string
    },
    useWebSearch = false
  ): Promise<ChatResponse> {
    const promptMaterial = getPromptMaterial(feature)
    const retrievalQuery = buildRetrievalQuery(userInput, fileContext)
    const retrievedChunks = await this.knowledgeRetriever.search(feature, retrievalQuery)

    let fullInput = userInput
    if (retrievedChunks.length > 0) {
      fullInput += `\n\n[RETRIEVED KNOWLEDGE]\n${formatRetrievedChunks(retrievedChunks)}`
    }

    if (fileContext) {
      fullInput += `\n\n[ATTACHED FILE CONTEXT]\n${buildAttachmentPromptContext(userInput, fileContext)}`
    }

    const webSearchRequested = shouldEnableGoogleSearch(feature, useWebSearch)
    const response = await this.provider.generateText({
      systemPrompt: promptMaterial.content,
      userInput: fullInput,
      temperature: resolveTemperature(feature),
      enableGoogleSearch: webSearchRequested,
      attachments: attachment ? [attachment] : undefined,
    })

    const structuredData = parseStructuredResponse(feature, response.rawText)
    const hasFallbackReply = response.rawText.includes(FAQ_FALLBACK_REPLY)
    const webSources = hasFallbackReply ? undefined : response.webSources
    const webSearchAttempted = webSearchRequested
    const webSourceCount = webSources?.length ?? 0
    const shouldHideRetrievedSources =
      (structuredData?.type === 'faq' && structuredData.data.answered_from_context === false) ||
      (feature === 'faq-rag' && hasFallbackReply)
    const contentType = resolveContentType(structuredData, response.rawText)
    const contentBlocks =
      contentType === 'structured'
        ? undefined
        : [
            {
              type: contentType === 'markdown' ? 'markdown' : 'text',
              text: response.rawText,
            } as const,
          ]

    return {
      reply: response.rawText,
      feature,
      structuredData,
      contentType,
      contentVersion: 'v1',
      contentBlocks,
      sources: shouldHideRetrievedSources
        ? []
        : retrievedChunks.map((chunk) => ({
            title: chunk.title,
            section: chunk.section,
            sourceUrl: chunk.sourceUrl,
            excerpt: truncateSourceExcerpt(chunk.text),
          })),
      webSources,
      debug: {
        webSearch: {
          requested: webSearchRequested,
          attempted: webSearchAttempted,
          used: webSourceCount > 0,
          sourceCount: webSourceCount,
          fallbackTriggered: hasFallbackReply,
        },
      },
    }
  }
}

const MAX_ATTACHMENT_RETRIEVAL_CHARS = 2500
const MAX_ATTACHMENT_PROMPT_CHARS = 80_000
const MAX_ATTACHMENT_EDGE_CHARS = 20_000
const MAX_ATTACHMENT_KEYWORD_SNIPPETS = 6
const ATTACHMENT_KEYWORD_RADIUS = 600
const FAQ_FALLBACK_REPLY =
  "I don't have enough information to answer that from the available policy documents. Please contact your course coordinator directly for guidance."

const SOURCE_EXCERPT_MAX_CHARS = 200

function truncateSourceExcerpt(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (normalized.length <= SOURCE_EXCERPT_MAX_CHARS) {
    return normalized
  }
  return `${normalized.slice(0, SOURCE_EXCERPT_MAX_CHARS)}…`
}

function buildRetrievalQuery(userInput: string, fileContext?: string): string {
  if (!fileContext) {
    return userInput
  }

  const normalized = fileContext.trim()
  if (!normalized) {
    return userInput
  }

  const truncated =
    normalized.length > MAX_ATTACHMENT_RETRIEVAL_CHARS
      ? `${normalized.slice(0, MAX_ATTACHMENT_RETRIEVAL_CHARS)}…`
      : normalized

  return `${userInput}\n\n[ATTACHMENT_SNIPPET]\n${truncated}`
}

function buildAttachmentPromptContext(userInput: string, fileContext: string): string {
  const normalized = fileContext.trim()
  if (!normalized) return ''
  if (normalized.length <= MAX_ATTACHMENT_PROMPT_CHARS) {
    return normalized
  }

  const head = normalized.slice(0, MAX_ATTACHMENT_EDGE_CHARS)
  const tail = normalized.slice(-MAX_ATTACHMENT_EDGE_CHARS)
  const keywordSnippets = extractKeywordSnippets(userInput, normalized)
  const snippetSection =
    keywordSnippets.length > 0
      ? `\n\n[KEYWORD SNIPPETS]\n${keywordSnippets.join('\n\n---\n\n')}`
      : ''

  return (
    `[ATTACHMENT TRUNCATED]\n` +
    `Original length: ${normalized.length} chars. Included the first ${MAX_ATTACHMENT_EDGE_CHARS} chars, ` +
    `last ${MAX_ATTACHMENT_EDGE_CHARS} chars, and targeted snippets matching your question.\n\n` +
    `[FILE START]\n${head}\n\n` +
    `[FILE END]\n${tail}` +
    snippetSection
  )
}

function extractKeywordSnippets(userInput: string, fileContext: string): string[] {
  const terms = uniqueQueryTerms(userInput)
  const snippets: string[] = []

  for (const term of terms) {
    if (snippets.length >= MAX_ATTACHMENT_KEYWORD_SNIPPETS) break
    const regex = new RegExp(escapeRegExp(term), 'i')
    const match = regex.exec(fileContext)
    if (!match || match.index === undefined) continue
    const center = match.index
    const start = Math.max(0, center - ATTACHMENT_KEYWORD_RADIUS)
    const end = Math.min(fileContext.length, center + term.length + ATTACHMENT_KEYWORD_RADIUS)
    const snippet = fileContext.slice(start, end).trim()
    if (!snippet) continue
    snippets.push(`Keyword: "${term}"\n${snippet}`)
  }

  return snippets
}

function uniqueQueryTerms(input: string): string[] {
  const stopWords = new Set([
    'the',
    'and',
    'for',
    'that',
    'this',
    'with',
    'from',
    'into',
    'about',
    'what',
    'when',
    'where',
    'which',
    'your',
    'have',
    'will',
    'would',
    'could',
    'should',
    'please',
    'check',
    'contract',
  ])
  const tokens = input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .filter((token) => !stopWords.has(token))
  return Array.from(new Set(tokens)).slice(0, MAX_ATTACHMENT_KEYWORD_SNIPPETS * 2)
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function resolveTemperature(feature: BenchmarkFeature): number {
  return feature === 'faq-rag' ? 0.35 : 0.1
}

function shouldEnableGoogleSearch(feature: BenchmarkFeature, faqWebSearchToggle: boolean): boolean {
  const googleSearchGloballyEnabled = process.env.GEMINI_ENABLE_GOOGLE_SEARCH !== 'false'
  if (!googleSearchGloballyEnabled) {
    return false
  }

  if (feature === 'faq-rag') {
    return faqWebSearchToggle
  }

  // For contract/job checkers, use web grounding as a secondary verification layer
  // (company legitimacy, domain context), unless explicitly disabled.
  return process.env.GEMINI_ENABLE_CHECKER_WEB_SEARCH !== 'false'
}

function resolveContentType(
  structuredData: StructuredChatData | undefined,
  rawText: string
): 'plain' | 'markdown' | 'structured' {
  if (structuredData) {
    return 'structured'
  }

  const hasMarkdownSignals =
    /(^|\n)\s{0,3}#{1,6}\s|\*\*|(^|\n)\s*[-*]\s|\[[^\]]+\]\([^)]+\)|```/m.test(rawText)
  return hasMarkdownSignals ? 'markdown' : 'plain'
}

function formatRetrievedChunks(chunks: RetrievedKnowledgeChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const source = chunk.sourceUrl ? `\nSource: ${chunk.sourceUrl}` : ''
      return `[${index + 1}] ${chunk.title} — ${chunk.section}${source}\n${chunk.text}`
    })
    .join('\n\n')
}

/**
 * Scan backwards from the last '}' to find its matching '{', then attempt
 * to parse the slice as JSON. This reliably extracts a JSON object that
 * appears at the end of a model response that may contain reasoning text
 * or markdown bullet points before the JSON block.
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

function parseStructuredResponse(
  feature: BenchmarkFeature,
  rawText: string
): StructuredChatData | undefined {
  const parsed = extractJsonFromText(rawText)
  if (!parsed || typeof parsed !== 'object') return undefined

  if (feature === 'contract-checker' || feature === 'job-checker') {
    const normalized = normalizeCheckerOutput(parsed)
    const result = checkerModelOutputSchema.safeParse(normalized)
    if (result.success) return { type: 'checker', data: result.data }
  } else if (feature === 'faq-rag') {
    const result = faqModelOutputSchema.safeParse(parsed)
    if (result.success) return { type: 'faq', data: result.data }
  }

  return undefined
}

function normalizeCheckerOutput(parsed: object): object {
  const asRecord = parsed as Record<string, unknown>
  const scratchpad = asRecord.scratchpad

  if (Array.isArray(scratchpad)) {
    return {
      ...asRecord,
      scratchpad: scratchpad
        .map((line) => (typeof line === 'string' ? line : JSON.stringify(line)))
        .join('\n'),
    }
  }

  return asRecord
}
