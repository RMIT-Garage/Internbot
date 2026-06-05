import { describe, expect, it } from 'vitest'
import { computeUsageMetrics } from '../../../../../src/application/benchmark/scoring/usageMetrics'
import type { BenchmarkCaseExecution } from '../../../../../src/application/benchmark/types'

describe('computeUsageMetrics', () => {
  it('computes token and cost aggregates', () => {
    const executions: BenchmarkCaseExecution[] = [
      {
        caseId: '1',
        name: 'with usage',
        feature: 'contract-checker',
        expected: { decision: 'Yes', failingRules: [], concerns: [] },
        rawResponse: '{}',
        parsedResponse: null,
        parseSuccess: false,
        latencyMs: 100,
        usage: { inputTokens: 1000, outputTokens: 200 },
        estimatedCostUsd: 0.00042,
      },
      {
        caseId: '2',
        name: 'without usage',
        feature: 'contract-checker',
        expected: { decision: 'No', failingRules: ['RULE'], concerns: [] },
        rawResponse: '{}',
        parsedResponse: null,
        parseSuccess: false,
        latencyMs: 120,
      },
    ]

    const metrics = computeUsageMetrics(executions)

    expect(metrics.usage_coverage_rate).toBe(0.5)
    expect(metrics.total_input_tokens).toBe(1000)
    expect(metrics.total_output_tokens).toBe(200)
    expect(metrics.total_tokens).toBe(1200)
    expect(metrics.avg_input_tokens).toBe(1000)
    expect(metrics.avg_output_tokens).toBe(200)
    expect(metrics.cost_coverage_rate).toBe(0.5)
    expect(metrics.total_cost_usd).toBe(0.00042)
    expect(metrics.avg_cost_usd_per_call).toBe(0.00042)
  })
})
