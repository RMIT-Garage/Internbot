import type { BenchmarkCaseExecution, FaqCase, FaqModelOutput } from '../types'

const DEFAULT_REFUSAL_MESSAGE =
  "I don't have enough information to answer that from the available policy documents. Please contact your course coordinator directly for guidance."

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4))
}

function sourceKey(source: { title: string; section: string }): string {
  return `${source.title.trim().toLowerCase()}::${source.section.trim().toLowerCase()}`
}

export function computeFaqMetrics(executions: BenchmarkCaseExecution[]): Record<string, number> {
  let parseSuccess = 0
  let answeredFromContextMatches = 0
  let unanswerableCases = 0
  let unanswerableRefused = 0
  let citationPresenceCases = 0
  let citationPresencePass = 0
  let citationSupportCases = 0
  let citationSupportPass = 0

  for (const execution of executions) {
    if (execution.parseSuccess) {
      parseSuccess += 1
    }

    if (!execution.parseSuccess || !execution.parsedResponse) {
      continue
    }

    const expected = execution.expected as FaqCase['expected']
    const parsed = execution.parsedResponse as FaqModelOutput

    if (parsed.answered_from_context === expected.answeredFromContext) {
      answeredFromContextMatches += 1
    }

    if (!expected.answeredFromContext) {
      unanswerableCases += 1
      const refusalMessage = expected.refusalMessage ?? DEFAULT_REFUSAL_MESSAGE
      if (!parsed.answered_from_context && parsed.answer.trim() === refusalMessage.trim()) {
        unanswerableRefused += 1
      }
    }

    if (expected.answeredFromContext) {
      citationPresenceCases += 1
      if (parsed.sources.length > 0) {
        citationPresencePass += 1
      }

      if (expected.requiredSources.length > 0) {
        citationSupportCases += 1
        const required = new Set(expected.requiredSources.map(sourceKey))
        const actual = new Set(parsed.sources.map(sourceKey))
        const allCovered = [...required].every((source) => actual.has(source))
        if (allCovered) {
          citationSupportPass += 1
        }
      }
    }
  }

  return {
    parse_success_rate: roundMetric(safeDivide(parseSuccess, executions.length)),
    answered_from_context_accuracy: roundMetric(
      safeDivide(answeredFromContextMatches, executions.length)
    ),
    refusal_rate_unanswerable: roundMetric(safeDivide(unanswerableRefused, unanswerableCases)),
    citation_presence_rate: roundMetric(safeDivide(citationPresencePass, citationPresenceCases)),
    citation_support_rate: roundMetric(safeDivide(citationSupportPass, citationSupportCases)),
  }
}
