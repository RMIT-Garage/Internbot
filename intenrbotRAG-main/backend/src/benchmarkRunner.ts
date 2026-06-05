import { runBenchmark } from './application/benchmark/runner'
import { writeBenchmarkReport } from './application/benchmark/reporting/reportWriter'
import { GeminiModelProvider } from './infrastructure/ai/geminiProvider'
import type { ModelProvider } from './application/ports/modelProvider'
import { ValidationError } from './domain/errors'
import {
  benchmarkFeatureSchema,
  benchmarkModeSchema,
  type BenchmarkFeature,
  type BenchmarkMode,
} from './application/benchmark/types'

class FixtureOnlyProvider implements ModelProvider {
  readonly name = 'fixture-provider'

  async generateText(): Promise<never> {
    throw new ValidationError('Fixture-only mode cannot call live model provider')
  }
}

interface CliOptions {
  feature: BenchmarkFeature | 'all'
  mode: BenchmarkMode
  fixtures: boolean
  model: string
  requestDelayMs?: number
  caseId?: string
  inputPricePer1k?: number
  outputPricePer1k?: number
}

function parseCaseId(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function validateCaseFiltering(options: CliOptions): void {
  if (options.caseId && options.feature === 'all') {
    throw new ValidationError('When using --case-id, you must also provide a specific --feature')
  }
}

function validateDelay(value: number | undefined): void {
  if (value !== undefined && value < 0) {
    throw new ValidationError('Delay cannot be negative')
  }
}
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback
  const normalized = value.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

function parsePrice(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid price value: ${value}`)
  }

  return parsed
}

function parseDelayMs(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ValidationError(`Invalid delay value: ${value}`)
  }

  return Math.floor(parsed)
}

function parseCliMap(argv: string[]): Map<string, string> {
  const params = new Map<string, string>()

  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [key, ...rest] = arg.slice(2).split('=')
    if (!key) continue
    params.set(key, rest.join('='))
  }

  return params
}

function parseFeature(raw: string): BenchmarkFeature | 'all' {
  if (raw === 'all') {
    return 'all'
  }

  try {
    return benchmarkFeatureSchema.parse(raw)
  } catch {
    throw new ValidationError(`Invalid --feature value: ${raw}`)
  }
}

function parseMode(raw: string): BenchmarkMode {
  try {
    return benchmarkModeSchema.parse(raw)
  } catch {
    throw new ValidationError(`Invalid --mode value: ${raw}`)
  }
}

function parseModel(raw: string | undefined): string {
  const model = raw ?? process.env.GEMINI_MODEL ?? 'gemini-2.5-flash-lite'
  if (!model.trim()) {
    throw new ValidationError('Model value cannot be empty')
  }
  return model
}

function resolveFeatures(feature: BenchmarkFeature | 'all'): BenchmarkFeature[] {
  return feature === 'all' ? ['contract-checker', 'job-checker', 'faq-rag'] : [feature]
}

function resolvePricing(
  options: CliOptions
): { inputPer1kTokensUsd: number; outputPer1kTokensUsd: number } | undefined {
  const envInput = parsePrice(process.env.BENCHMARK_PRICE_INPUT_PER_1K_USD)
  const envOutput = parsePrice(process.env.BENCHMARK_PRICE_OUTPUT_PER_1K_USD)

  const input = options.inputPricePer1k ?? envInput
  const output = options.outputPricePer1k ?? envOutput

  if (typeof input === 'number' && typeof output === 'number') {
    return {
      inputPer1kTokensUsd: input,
      outputPer1kTokensUsd: output,
    }
  }

  return undefined
}

function resolveRequestDelayMs(options: CliOptions): number | undefined {
  const envDelay = parseDelayMs(process.env.BENCHMARK_REQUEST_DELAY_MS)
  return options.requestDelayMs ?? envDelay
}

function validateLiveRunRequirements(options: CliOptions): void {
  if (!options.fixtures && !process.env.GEMINI_API_KEY) {
    throw new ValidationError('GEMINI_API_KEY is required when running without fixture responses')
  }

  if (
    !options.fixtures &&
    options.inputPricePer1k === undefined &&
    options.outputPricePer1k === undefined
  ) {
    const hasEnvPricing =
      parsePrice(process.env.BENCHMARK_PRICE_INPUT_PER_1K_USD) !== undefined &&
      parsePrice(process.env.BENCHMARK_PRICE_OUTPUT_PER_1K_USD) !== undefined

    if (!hasEnvPricing) {
      throw new ValidationError(
        'Pricing is required for live runs. Set BENCHMARK_PRICE_INPUT_PER_1K_USD and BENCHMARK_PRICE_OUTPUT_PER_1K_USD or pass --input-price-per-1k and --output-price-per-1k'
      )
    }
  }
}

function parseCliArgs(argv: string[]): CliOptions {
  const params = parseCliMap(argv)

  const modeRaw = params.get('mode') ?? 'smoke'
  const options: CliOptions = {
    feature: parseFeature(params.get('feature') ?? 'all'),
    mode: parseMode(modeRaw),
    fixtures: parseBoolean(params.get('fixtures'), modeRaw === 'smoke'),
    model: parseModel(params.get('model')),
    requestDelayMs: parseDelayMs(params.get('delay-ms')),
    caseId: parseCaseId(params.get('case-id')),
    inputPricePer1k: parsePrice(params.get('input-price-per-1k')),
    outputPricePer1k: parsePrice(params.get('output-price-per-1k')),
  }

  if ((options.inputPricePer1k === undefined) !== (options.outputPricePer1k === undefined)) {
    throw new ValidationError(
      'Both --input-price-per-1k and --output-price-per-1k must be provided together'
    )
  }

  validateDelay(options.requestDelayMs)
  validateCaseFiltering(options)
  validateLiveRunRequirements(options)
  return options
}

function createProvider(options: CliOptions): ModelProvider {
  return options.fixtures
    ? new FixtureOnlyProvider()
    : new GeminiModelProvider({ model: options.model })
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2))
  const provider = createProvider(options)
  const pricing = resolvePricing(options)
  const requestDelayMs = resolveRequestDelayMs(options)

  let failed = false

  for (const feature of resolveFeatures(options.feature)) {
    const result = await runBenchmark({
      feature,
      mode: options.mode,
      provider,
      model: options.model,
      useFixtureResponses: options.fixtures,
      pricing,
      requestDelayMs,
      caseId: options.caseId,
    })

    const report = writeBenchmarkReport(result)
    console.info(
      `[benchmark] feature=${feature} mode=${options.mode} pass=${result.pass} json=${report.jsonPath} md=${report.markdownPath}`
    )

    if (!result.pass) {
      failed = true
    }
  }

  if (failed) {
    process.exitCode = 1
  }
}

void main()
