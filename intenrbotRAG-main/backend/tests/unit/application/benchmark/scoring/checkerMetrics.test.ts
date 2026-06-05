import { describe, expect, it } from 'vitest'
import { computeCheckerMetrics } from '../../../../../src/application/benchmark/scoring/checkerMetrics'
import type { BenchmarkCaseExecution } from '../../../../../src/application/benchmark/types'

describe('computeCheckerMetrics', () => {
  it('computes parse, accuracy, precision, recall and f1', () => {
    const executions: BenchmarkCaseExecution[] = [
      {
        caseId: '1',
        name: 'yes-correct',
        feature: 'contract-checker',
        expected: { decision: 'Yes', failingRules: [], concerns: [] },
        rawResponse: '{}',
        parsedResponse: {
          scratchpad: 'all pass',
          decision: 'Yes',
          confidence: 0.9,
          concerns: [],
          summary: 'ok',
        },
        parseSuccess: true,
        latencyMs: 100,
      },
      {
        caseId: '2',
        name: 'no-correct',
        feature: 'contract-checker',
        expected: { decision: 'No', failingRules: ['RULE_1'], concerns: ['wrong award'] },
        rawResponse: '{}',
        parsedResponse: {
          scratchpad: 'rule1 fail',
          decision: 'No',
          confidence: 0.95,
          concerns: ['wrong award'],
          summary: 'fail',
        },
        parseSuccess: true,
        latencyMs: 120,
      },
      {
        caseId: '3',
        name: 'parse-fail',
        feature: 'contract-checker',
        expected: { decision: 'Yes', failingRules: [], concerns: [] },
        rawResponse: 'bad',
        parsedResponse: null,
        parseSuccess: false,
        latencyMs: 90,
      },
    ]

    const metrics = computeCheckerMetrics(executions)

    expect(metrics.parse_success_rate).toBeCloseTo(0.6667, 4)
    expect(metrics.decision_accuracy).toBeCloseTo(0.6667, 4)
    expect(metrics.precision_yes).toBe(1)
    expect(metrics.recall_yes).toBeCloseTo(0.5, 4)
    expect(metrics.f1_yes).toBeCloseTo(0.6667, 4)
    expect(metrics.latency_ms_avg).toBeCloseTo(103.3333, 4)
  })
})
