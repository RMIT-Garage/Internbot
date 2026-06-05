import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type Router as ExpressRouter,
} from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { runBenchmark } from '../../application/benchmark/runner'
import {
  benchmarkFeatureSchema,
  benchmarkModeSchema,
  type BenchmarkCaseExecution,
} from '../../application/benchmark/types'
import type { ModelProvider } from '../../application/ports/modelProvider'
import { GeminiModelProvider } from '../../infrastructure/ai/geminiProvider'
import { ValidationError } from '../../domain/errors'
import { ApiError } from '../errors'

const router: ExpressRouter = Router()

const DEFAULT_MODEL = 'gemini-2.0-flash-lite'

const benchmarkRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    type: 'https://httpstatuses.io/429',
    title: 'Too Many Requests',
    status: 429,
    detail: 'Too many benchmark requests, please try again later',
  },
})

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function parsePrice(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }

  return parsed
}

function parseDelayMs(value: string | undefined): number | undefined {
  if (!value) return undefined

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return undefined
  }

  return Math.floor(parsed)
}

const singleCaseRequestSchema = z
  .object({
    feature: benchmarkFeatureSchema,
    mode: benchmarkModeSchema.default('smoke'),
    caseId: z.string().trim().min(1, 'caseId is required'),
    fixtures: z.boolean().default(true),
    model: z.string().trim().min(1).optional(),
    delayMs: z.number().int().min(0).max(10000).optional(),
    inputPricePer1k: z.number().min(0).optional(),
    outputPricePer1k: z.number().min(0).optional(),
  })
  .superRefine((input, ctx) => {
    const hasInputPricing = input.inputPricePer1k !== undefined
    const hasOutputPricing = input.outputPricePer1k !== undefined

    if (hasInputPricing !== hasOutputPricing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: hasInputPricing ? ['outputPricePer1k'] : ['inputPricePer1k'],
        message: 'Both inputPricePer1k and outputPricePer1k must be provided together',
      })
    }
  })

class FixtureOnlyProvider implements ModelProvider {
  readonly name = 'fixture-provider'

  async generateText(): Promise<never> {
    throw new ValidationError('Fixture-only mode cannot call live model provider')
  }
}

function mapExecution(execution: BenchmarkCaseExecution) {
  return {
    caseId: execution.caseId,
    name: execution.name,
    parseSuccess: execution.parseSuccess,
    latencyMs: execution.latencyMs,
    expected: execution.expected,
    parsedResponse: execution.parsedResponse,
    rawResponse: execution.rawResponse,
    usage: execution.usage,
    estimatedCostUsd: execution.estimatedCostUsd,
    error: execution.error,
  }
}

router.post(
  '/single-case',
  benchmarkRouteLimiter,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const parsed = singleCaseRequestSchema.safeParse({
      feature: req.body?.feature,
      mode: req.body?.mode,
      caseId: req.body?.caseId,
      fixtures: req.body?.fixtures,
      model: req.body?.model,
      delayMs: parseOptionalNumber(req.body?.delayMs),
      inputPricePer1k: parseOptionalNumber(req.body?.inputPricePer1k),
      outputPricePer1k: parseOptionalNumber(req.body?.outputPricePer1k),
    })

    if (!parsed.success) {
      next(
        new ApiError(400, 'Bad Request', parsed.error.issues[0]?.message ?? 'Invalid request body')
      )
      return
    }

    const options = parsed.data

    try {
      const provider: ModelProvider = options.fixtures
        ? new FixtureOnlyProvider()
        : new GeminiModelProvider({ model: options.model })

      const model = options.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL
      const envPricing = {
        inputPricePer1k: parsePrice(process.env.BENCHMARK_PRICE_INPUT_PER_1K_USD),
        outputPricePer1k: parsePrice(process.env.BENCHMARK_PRICE_OUTPUT_PER_1K_USD),
      }

      const inputPricePer1k = options.inputPricePer1k ?? envPricing.inputPricePer1k
      const outputPricePer1k = options.outputPricePer1k ?? envPricing.outputPricePer1k

      const pricing =
        typeof inputPricePer1k === 'number' && typeof outputPricePer1k === 'number'
          ? {
              inputPer1kTokensUsd: inputPricePer1k,
              outputPer1kTokensUsd: outputPricePer1k,
            }
          : undefined

      const requestDelayMs = options.delayMs ?? parseDelayMs(process.env.BENCHMARK_REQUEST_DELAY_MS)

      const result = await runBenchmark({
        feature: options.feature,
        mode: options.mode,
        provider,
        model,
        useFixtureResponses: options.fixtures,
        requestDelayMs,
        caseId: options.caseId,
        pricing,
      })

      const execution = result.executions[0]
      if (!execution) {
        next(new ApiError(500, 'Internal Server Error', 'No execution result was produced'))
        return
      }

      res.status(200).json({
        runId: result.metadata.runId,
        feature: result.metadata.feature,
        mode: result.metadata.mode,
        pass: result.pass,
        metrics: result.metrics,
        minThresholds: result.minThresholds,
        maxThresholds: result.maxThresholds,
        metadata: result.metadata,
        execution: mapExecution(execution),
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('Case id')) {
        next(new ApiError(400, 'Bad Request', error.message))
        return
      }

      next(error)
    }
  }
)

export { router as benchmarksRouter }
