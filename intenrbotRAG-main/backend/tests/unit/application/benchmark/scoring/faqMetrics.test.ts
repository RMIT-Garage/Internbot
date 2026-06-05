import { describe, expect, it } from 'vitest'
import { computeFaqMetrics } from '../../../../../src/application/benchmark/scoring/faqMetrics'
import type { BenchmarkCaseExecution } from '../../../../../src/application/benchmark/types'

describe('computeFaqMetrics', () => {
  it('computes refusal and citation metrics', () => {
    const executions: BenchmarkCaseExecution[] = [
      {
        caseId: 'faq-1',
        name: 'answerable',
        feature: 'faq-rag',
        expected: {
          answeredFromContext: true,
          requiredSources: [{ title: 'Doc A', section: 'S1' }],
        },
        rawResponse: '{}',
        parsedResponse: {
          answer: 'Found in context',
          sources: [{ title: 'Doc A', section: 'S1' }],
          confidence: 0.9,
          answered_from_context: true,
        },
        parseSuccess: true,
        latencyMs: 100,
      },
      {
        caseId: 'faq-2',
        name: 'unanswerable refusal',
        feature: 'faq-rag',
        expected: {
          answeredFromContext: false,
          refusalMessage:
            "I don't have enough information to answer that from the available policy documents. Please contact your course coordinator directly for guidance.",
          requiredSources: [],
        },
        rawResponse: '{}',
        parsedResponse: {
          answer:
            "I don't have enough information to answer that from the available policy documents. Please contact your course coordinator directly for guidance.",
          sources: [],
          confidence: 0,
          answered_from_context: false,
        },
        parseSuccess: true,
        latencyMs: 90,
      },
      {
        caseId: 'faq-3',
        name: 'parse fail',
        feature: 'faq-rag',
        expected: {
          answeredFromContext: true,
          requiredSources: [],
        },
        rawResponse: 'bad',
        parsedResponse: null,
        parseSuccess: false,
        latencyMs: 110,
      },
    ]

    const metrics = computeFaqMetrics(executions)

    expect(metrics.parse_success_rate).toBeCloseTo(0.6667, 4)
    expect(metrics.answered_from_context_accuracy).toBeCloseTo(0.6667, 4)
    expect(metrics.refusal_rate_unanswerable).toBe(1)
    expect(metrics.citation_presence_rate).toBe(1)
    expect(metrics.citation_support_rate).toBe(1)
  })
})
