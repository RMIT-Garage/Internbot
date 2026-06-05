import { randomUUID } from 'node:crypto'
import type { ModelUsage, ModelProvider } from '../ports/modelProvider'
import { getPromptMaterial } from '../prompts/registry'
import { getFeatureModeConfig } from './config'
import { loadDataset } from './dataset'
import { parseModelOutput } from './parser'
import { computeCheckerMetrics } from './scoring/checkerMetrics'
import { computeFaqMetrics } from './scoring/faqMetrics'
import { computeUsageMetrics } from './scoring/usageMetrics'
import type {
  BenchmarkCase,
  BenchmarkCaseExecution,
  BenchmarkFeature,
  BenchmarkMode,
  BenchmarkRunResult,
} from './types'

export interface BenchmarkRunnerOptions {
  feature: BenchmarkFeature
  mode: BenchmarkMode
  provider: ModelProvider
  model: string
  useFixtureResponses?: boolean
  requestDelayMs?: number
  caseId?: string
  pricing?: {
    inputPer1kTokensUsd: number
    outputPer1kTokensUsd: number
  }
}

function normalizeCaseId(caseId: string | undefined): string | undefined {
  if (!caseId) {
    return undefined
  }

  const trimmed = caseId.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function selectDatasetCases(cases: BenchmarkCase[], caseId: string | undefined): BenchmarkCase[] {
  const normalizedCaseId = normalizeCaseId(caseId)
  if (!normalizedCaseId) {
    return cases
  }

  const selected = cases.find((testCase) => testCase.id === normalizedCaseId)
  if (!selected) {
    throw new Error(`Case id '${normalizedCaseId}' was not found in the selected dataset`)
  }

  return [selected]
}

function validateCaseId(caseId: string | undefined): void {
  if (!caseId) {
    return
  }

  if (caseId.trim().length === 0) {
    throw new Error('Case id cannot be empty')
  }
}

function resolveCaseId(caseId: string | undefined): string | undefined {
  validateCaseId(caseId)
  return normalizeCaseId(caseId)
}

function getRunCaseId(options: BenchmarkRunnerOptions): string | undefined {
  return resolveCaseId(options.caseId)
}
function isCheckerFeature(
  feature: BenchmarkFeature
): feature is 'contract-checker' | 'job-checker' {
  return feature === 'contract-checker' || feature === 'job-checker'
}

function buildInputText(testCase: BenchmarkCase): string {
  if (testCase.feature === 'faq-rag') {
    const chunks = testCase.input.retrievedChunks
      .map(
        (chunk, index) =>
          `# Chunk ${index + 1}\nTitle: ${chunk.title}\nSection: ${chunk.section}\n${chunk.text}`
      )
      .join('\n\n')

    return [`Question: ${testCase.input.question}`, '', 'Retrieved context:', chunks].join('\n')
  }

  return testCase.input.text
}

function estimateCostUsd(
  usage: ModelUsage | undefined,
  pricing: BenchmarkRunnerOptions['pricing']
): number | undefined {
  if (!usage || !pricing) {
    return undefined
  }

  const inputTokens = usage.inputTokens ?? 0
  const outputTokens = usage.outputTokens ?? 0

  const inputCost = (inputTokens / 1000) * pricing.inputPer1kTokensUsd
  const outputCost = (outputTokens / 1000) * pricing.outputPer1kTokensUsd
  return Number((inputCost + outputCost).toFixed(8))
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function resolveRequestDelayMs(delayMs: number | undefined): number {
  if (typeof delayMs === 'number' && delayMs > 0) {
    return Math.floor(delayMs)
  }

  const envDelay = Number(process.env.BENCHMARK_REQUEST_DELAY_MS ?? 0)
  return Number.isFinite(envDelay) && envDelay > 0 ? Math.floor(envDelay) : 0
}

async function executeCase(params: {
  feature: BenchmarkFeature
  testCase: BenchmarkCase
  provider: ModelProvider
  prompt: string
  useFixtureResponses: boolean
  pricing: BenchmarkRunnerOptions['pricing']
}): Promise<BenchmarkCaseExecution> {
  const startedAt = Date.now()

  try {
    let rawResponse: string
    let usage: ModelUsage | undefined

    if (params.useFixtureResponses) {
      if (!params.testCase.fixtureResponse) {
        throw new Error(`Fixture response missing for case '${params.testCase.id}'`)
      }
      rawResponse = JSON.stringify(params.testCase.fixtureResponse)
    } else {
      const modelResponse = await params.provider.generateText({
        systemPrompt: params.prompt,
        userInput: buildInputText(params.testCase),
      })
      rawResponse = modelResponse.rawText
      usage = modelResponse.usage
    }

    const parsed = parseModelOutput(rawResponse, params.feature)

    return {
      caseId: params.testCase.id,
      name: params.testCase.name,
      feature: params.feature,
      expected: params.testCase.expected,
      rawResponse,
      parsedResponse: parsed.parsed,
      parseSuccess: parsed.parseSuccess,
      latencyMs: Date.now() - startedAt,
      usage,
      estimatedCostUsd: estimateCostUsd(usage, params.pricing),
    }
  } catch (error) {
    return {
      caseId: params.testCase.id,
      name: params.testCase.name,
      feature: params.feature,
      expected: params.testCase.expected,
      rawResponse: '',
      parsedResponse: null,
      parseSuccess: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown benchmark error',
    }
  }
}

function normalizeThresholds(
  profile: { min?: Record<string, number>; max?: Record<string, number> },
  pricing: BenchmarkRunnerOptions['pricing']
): { min: Record<string, number>; max: Record<string, number> } {
  const min = profile.min ?? {}
  const max = profile.max ?? {}

  if (pricing) {
    return { min, max }
  }

  const maxWithoutCost = Object.fromEntries(
    Object.entries(max).filter(([metricName]) => !metricName.includes('cost'))
  )

  return { min, max: maxWithoutCost }
}

function evaluateThresholds(
  thresholds: { min: Record<string, number>; max: Record<string, number> },
  metrics: Record<string, number>
): boolean {
  const minPass = Object.entries(thresholds.min).every(([metricName, threshold]) => {
    const observed = metrics[metricName]
    return typeof observed === 'number' && observed >= threshold
  })

  const maxPass = Object.entries(thresholds.max).every(([metricName, threshold]) => {
    const observed = metrics[metricName]
    return typeof observed === 'number' && observed <= threshold
  })

  return minPass && maxPass
}

function computeMetrics(
  feature: BenchmarkFeature,
  executions: BenchmarkCaseExecution[]
): Record<string, number> {
  const featureMetrics = isCheckerFeature(feature)
    ? computeCheckerMetrics(executions)
    : computeFaqMetrics(executions)

  return {
    ...featureMetrics,
    ...computeUsageMetrics(executions),
  }
}

export async function runBenchmark(options: BenchmarkRunnerOptions): Promise<BenchmarkRunResult> {
  const startedAtIso = new Date().toISOString()
  const runId = randomUUID()

  const featureMode = getFeatureModeConfig(options.feature, options.mode)
  const thresholds = normalizeThresholds(featureMode.thresholds, options.pricing)
  const dataset = loadDataset(options.feature, featureMode.datasetPath)
  const prompt = getPromptMaterial(options.feature)
  const requestDelayMs = resolveRequestDelayMs(options.requestDelayMs)
  const selectedCases = selectDatasetCases(dataset.cases, getRunCaseId(options))

  const executions: BenchmarkCaseExecution[] = []
  for (const [index, testCase] of selectedCases.entries()) {
    if (index > 0 && requestDelayMs > 0) {
      await sleep(requestDelayMs)
    }

    const execution = await executeCase({
      feature: options.feature,
      testCase,
      provider: options.provider,
      prompt: prompt.content,
      useFixtureResponses: options.useFixtureResponses ?? false,
      pricing: options.pricing,
    })
    executions.push(execution)
  }

  const metrics = computeMetrics(options.feature, executions)
  const pass = evaluateThresholds(thresholds, metrics)
  const finishedAtIso = new Date().toISOString()

  return {
    metadata: {
      runId,
      mode: options.mode,
      feature: options.feature,
      provider: options.provider.name,
      model: options.model,
      promptVersion: prompt.version,
      promptPath: prompt.path,
      startedAtIso,
      finishedAtIso,
      usedFixtureResponses: options.useFixtureResponses ?? false,
    },
    executions,
    metrics,
    minThresholds: thresholds.min,
    maxThresholds: thresholds.max,
    pass,
  }
}
