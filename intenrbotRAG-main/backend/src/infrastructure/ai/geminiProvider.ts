import { UpstreamServiceError, ValidationError } from '../../domain/errors'
import type {
  GenerateTextRequest,
  GenerateTextResponse,
  ModelProvider,
  WebSource,
} from '../../application/ports/modelProvider'

interface GeminiProviderOptions {
  apiKey?: string
  model?: string
  endpoint?: string
  maxRetries?: number
  baseRetryDelayMs?: number
  maxRetryDelayMs?: number
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string
          title?: string
        }
      }>
    }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

interface GeminiContentPart {
  text?: string
  inlineData?: {
    mimeType: string
    data: string
  }
}

interface GroundingChunk {
  web?: {
    uri?: string
    title?: string
  }
}

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'gemini-2.5-flash'
const DEFAULT_MAX_RETRIES = 4
const DEFAULT_BASE_RETRY_DELAY_MS = 1500
const DEFAULT_MAX_RETRY_DELAY_MS = 60000

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback
  }

  return parsed
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500
}

function extractRetryDelayMs(errorBody: string): number | undefined {
  const retryDelayMatch = errorBody.match(/"retryDelay"\s*:\s*"(\d+)s"/)
  if (retryDelayMatch?.[1]) {
    const seconds = Number(retryDelayMatch[1])
    if (!Number.isNaN(seconds)) {
      return seconds * 1000
    }
  }

  const retryInTextMatch = errorBody.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i)
  if (retryInTextMatch?.[1]) {
    const seconds = Number(retryInTextMatch[1])
    if (!Number.isNaN(seconds)) {
      return Math.ceil(seconds * 1000)
    }
  }

  return undefined
}

function getBackoffDelayMs(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt)
  return Math.min(exponential, maxDelayMs)
}

export class GeminiModelProvider implements ModelProvider {
  readonly name = 'google-gemini'

  private readonly apiKey: string
  private readonly model: string
  private readonly endpoint: string
  private readonly maxRetries: number
  private readonly baseRetryDelayMs: number
  private readonly maxRetryDelayMs: number

  constructor(options: GeminiProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? ''
    this.model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL
    this.endpoint = options.endpoint ?? process.env.GEMINI_ENDPOINT ?? DEFAULT_ENDPOINT
    this.maxRetries =
      options.maxRetries ?? parseNumber(process.env.GEMINI_RETRY_MAX_ATTEMPTS, DEFAULT_MAX_RETRIES)
    this.baseRetryDelayMs =
      options.baseRetryDelayMs ??
      parseNumber(process.env.GEMINI_RETRY_BASE_DELAY_MS, DEFAULT_BASE_RETRY_DELAY_MS)
    this.maxRetryDelayMs =
      options.maxRetryDelayMs ??
      parseNumber(process.env.GEMINI_RETRY_MAX_DELAY_MS, DEFAULT_MAX_RETRY_DELAY_MS)

    if (!this.apiKey) {
      throw new ValidationError('GEMINI_API_KEY is required for Gemini benchmark runs')
    }
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await fetch(
        `${this.endpoint}/models/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: request.systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: buildUserParts(request.userInput, request.attachments),
              },
            ],
            generationConfig: {
              temperature: request.temperature ?? 0,
            },
            ...(request.enableGoogleSearch ? { tools: [{ googleSearch: {} }] } : {}),
          }),
        }
      )

      if (!response.ok) {
        const errText = await response.text()
        const canRetry = attempt < this.maxRetries && isRetryableStatus(response.status)

        if (!canRetry) {
          throw new UpstreamServiceError(
            `Gemini API request failed (${response.status}): ${errText}`
          )
        }

        const retryDelayMs =
          extractRetryDelayMs(errText) ??
          getBackoffDelayMs(attempt, this.baseRetryDelayMs, this.maxRetryDelayMs)

        await sleep(retryDelayMs)
        continue
      }

      const payload = (await response.json()) as GeminiGenerateContentResponse
      const primaryCandidate = payload.candidates?.[0]
      const rawText =
        primaryCandidate?.content?.parts?.map((part) => part.text ?? '').join('') ?? ''

      if (!rawText) {
        const canRetryEmpty = attempt < this.maxRetries
        if (canRetryEmpty) {
          const retryDelayMs = getBackoffDelayMs(
            attempt,
            this.baseRetryDelayMs,
            this.maxRetryDelayMs
          )
          await sleep(retryDelayMs)
          continue
        }
        throw new UpstreamServiceError('Gemini returned empty content after retries')
      }

      const webSources = mapGroundingSources(primaryCandidate?.groundingMetadata?.groundingChunks)
      const usage = payload.usageMetadata
        ? {
            inputTokens: payload.usageMetadata.promptTokenCount,
            outputTokens: payload.usageMetadata.candidatesTokenCount,
          }
        : undefined

      return {
        rawText,
        usage,
        webSources: webSources.length > 0 ? webSources : undefined,
      }
    }

    throw new UpstreamServiceError('Gemini API request retries exhausted')
  }
}

function buildUserParts(
  userInput: string,
  attachments: GenerateTextRequest['attachments']
): GeminiContentPart[] {
  const parts: GeminiContentPart[] = [{ text: userInput }]
  if (!attachments || attachments.length === 0) {
    return parts
  }

  for (const attachment of attachments) {
    const mimeType = attachment.mimeType?.trim()
    const data = attachment.dataBase64?.trim()
    if (!mimeType || !data) continue
    parts.push({
      inlineData: {
        mimeType,
        data,
      },
    })
  }

  return parts
}

function mapGroundingSources(groundingChunks?: GroundingChunk[]): WebSource[] {
  if (!Array.isArray(groundingChunks)) {
    return []
  }

  const uniqueSources = new Map<string, WebSource>()
  for (const chunk of groundingChunks) {
    const title = chunk?.web?.title?.trim()
    const uri = chunk?.web?.uri?.trim()
    if (!title || !uri) {
      continue
    }
    if (!uniqueSources.has(uri)) {
      uniqueSources.set(uri, { title, uri })
    }
  }

  return Array.from(uniqueSources.values())
}
