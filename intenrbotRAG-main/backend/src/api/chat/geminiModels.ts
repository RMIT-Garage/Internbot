import { ValidationError } from '../../domain/errors'

export function normalizeModelName(model?: string): string | undefined {
  if (!model) return undefined
  const trimmed = model.trim()
  if (!trimmed) return undefined
  const normalized = trimmed.startsWith('models/') ? trimmed.slice('models/'.length) : trimmed
  return isDeprecatedGeminiModel(normalized) ? undefined : normalized
}

interface GeminiModelListResponse {
  models?: Array<{
    name?: string
    supportedGenerationMethods?: string[]
  }>
}

export async function listGeminiGenerateModels(): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  const endpoint = process.env.GEMINI_ENDPOINT ?? 'https://generativelanguage.googleapis.com/v1beta'

  if (!apiKey) {
    throw new ValidationError('GEMINI_API_KEY is required to list chat models')
  }

  const response = await fetch(`${endpoint}/models?key=${encodeURIComponent(apiKey)}`, {
    method: 'GET',
  })
  if (!response.ok) {
    throw new ValidationError(
      `Failed to list Gemini models (${response.status}): ${await response.text()}`
    )
  }

  const payload = (await response.json()) as GeminiModelListResponse
  const models = (payload.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes('generateContent'))
    .map((model) => model.name ?? '')
    .map((name) => (name.startsWith('models/') ? name.slice('models/'.length) : name))
    .filter((name) => name.startsWith('gemini-') || name.startsWith('gemma-'))
    .filter((name) => !isDeprecatedGeminiModel(name))
    .sort((a, b) => a.localeCompare(b))

  return Array.from(new Set(models))
}

export function isDeprecatedGeminiModel(model: string): boolean {
  return model.startsWith('gemini-2.0-')
}
