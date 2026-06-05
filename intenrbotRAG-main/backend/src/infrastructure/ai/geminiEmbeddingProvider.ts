import { ValidationError } from '../../domain/errors'
import type { EmbeddingProvider } from '../../application/ports/embeddingProvider'

interface GeminiEmbeddingProviderOptions {
  apiKey?: string
  model?: string
  endpoint?: string
  outputDimensionality?: number
}

interface GeminiEmbeddingResponse {
  embedding?: {
    values?: number[]
  }
}

const DEFAULT_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_MODEL = 'text-embedding-004'

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  private readonly apiKey: string
  private readonly model: string
  private readonly endpoint: string
  private readonly outputDimensionality?: number

  constructor(options: GeminiEmbeddingProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? ''
    this.model = options.model ?? process.env.GEMINI_EMBEDDING_MODEL ?? DEFAULT_MODEL
    this.endpoint = options.endpoint ?? process.env.GEMINI_ENDPOINT ?? DEFAULT_ENDPOINT
    this.outputDimensionality = parseOutputDimensionality(
      options.outputDimensionality ?? process.env.GEMINI_EMBEDDING_DIMENSION
    )

    if (!this.apiKey) {
      throw new ValidationError('GEMINI_API_KEY is required for embeddings')
    }
  }

  async embed(text: string): Promise<number[]> {
    const response = await fetch(
      `${this.endpoint}/models/${encodeURIComponent(this.model)}:embedContent?key=${encodeURIComponent(this.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{ text }],
          },
          ...(this.outputDimensionality ? { outputDimensionality: this.outputDimensionality } : {}),
        }),
      }
    )

    if (!response.ok) {
      throw new ValidationError(
        `Gemini embedding request failed (${response.status}): ${await response.text()}`
      )
    }

    const payload = (await response.json()) as GeminiEmbeddingResponse
    const values = payload.embedding?.values

    if (!values || values.length === 0) {
      throw new ValidationError('Gemini embedding response was empty')
    }

    return values
  }
}

function parseOutputDimensionality(value: number | string | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
