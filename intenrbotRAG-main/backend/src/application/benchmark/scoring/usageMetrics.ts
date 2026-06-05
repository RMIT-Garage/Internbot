import type { BenchmarkCaseExecution } from '../types'

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function roundMetric(value: number): number {
  return Number(value.toFixed(6))
}

export function computeUsageMetrics(executions: BenchmarkCaseExecution[]): Record<string, number> {
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let usageCases = 0
  let totalCostUsd = 0
  let costCases = 0

  for (const execution of executions) {
    const usage = execution.usage
    const inputTokens = usage?.inputTokens ?? 0
    const outputTokens = usage?.outputTokens ?? 0

    if (inputTokens > 0 || outputTokens > 0) {
      usageCases += 1
      totalInputTokens += inputTokens
      totalOutputTokens += outputTokens
    }

    if (typeof execution.estimatedCostUsd === 'number') {
      totalCostUsd += execution.estimatedCostUsd
      costCases += 1
    }
  }

  return {
    usage_coverage_rate: roundMetric(safeDivide(usageCases, executions.length)),
    total_input_tokens: roundMetric(totalInputTokens),
    total_output_tokens: roundMetric(totalOutputTokens),
    total_tokens: roundMetric(totalInputTokens + totalOutputTokens),
    avg_input_tokens: roundMetric(safeDivide(totalInputTokens, usageCases)),
    avg_output_tokens: roundMetric(safeDivide(totalOutputTokens, usageCases)),
    cost_coverage_rate: roundMetric(safeDivide(costCases, executions.length)),
    total_cost_usd: roundMetric(totalCostUsd),
    avg_cost_usd_per_call: roundMetric(safeDivide(totalCostUsd, costCases)),
  }
}
