import type {
  BenchmarkCaseExecution,
  CheckerModelOutput,
  ContractCheckerCase,
  JobCheckerCase,
} from '../types'

interface BinaryCounts {
  tp: number
  fp: number
  fn: number
}

function safeDivide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function roundMetric(value: number): number {
  return Number(value.toFixed(4))
}

function getDecision(caseExecution: BenchmarkCaseExecution): 'Yes' | 'No' | null {
  if (!caseExecution.parseSuccess || !caseExecution.parsedResponse) {
    return null
  }
  const parsed = caseExecution.parsedResponse as CheckerModelOutput
  return parsed.decision
}

function concernMatchScore(expectedConcerns: string[], predictedConcerns: string[]): number {
  if (expectedConcerns.length === 0) {
    return predictedConcerns.length === 0 ? 1 : 0
  }

  const expectedNormalized = expectedConcerns.map((c) => c.toLowerCase())
  const predictedNormalized = predictedConcerns.map((c) => c.toLowerCase())

  let matched = 0
  for (const expected of expectedNormalized) {
    if (predictedNormalized.some((pred) => pred.includes(expected) || expected.includes(pred))) {
      matched += 1
    }
  }

  return matched / expectedConcerns.length
}

export function computeCheckerMetrics(
  executions: BenchmarkCaseExecution[]
): Record<string, number> {
  let parseSuccess = 0
  let exactDecisionMatches = 0
  let sumLatency = 0
  let withLatency = 0
  let concernScoreTotal = 0
  let concernScoreCases = 0

  const yesCounts: BinaryCounts = { tp: 0, fp: 0, fn: 0 }

  for (const execution of executions) {
    if (execution.parseSuccess) {
      parseSuccess += 1
    }

    const expected = execution.expected as
      | ContractCheckerCase['expected']
      | JobCheckerCase['expected']
    const predictedDecision = getDecision(execution)

    if (predictedDecision && predictedDecision === expected.decision) {
      exactDecisionMatches += 1
    }

    if (predictedDecision === 'Yes' && expected.decision === 'Yes') {
      yesCounts.tp += 1
    } else if (predictedDecision === 'Yes' && expected.decision === 'No') {
      yesCounts.fp += 1
    } else if (predictedDecision !== 'Yes' && expected.decision === 'Yes') {
      yesCounts.fn += 1
    }

    if (execution.parseSuccess && execution.parsedResponse) {
      const parsed = execution.parsedResponse as CheckerModelOutput
      concernScoreTotal += concernMatchScore(expected.concerns, parsed.concerns)
      concernScoreCases += 1
    }

    if (execution.latencyMs >= 0) {
      sumLatency += execution.latencyMs
      withLatency += 1
    }
  }

  const precisionYes = safeDivide(yesCounts.tp, yesCounts.tp + yesCounts.fp)
  const recallYes = safeDivide(yesCounts.tp, yesCounts.tp + yesCounts.fn)
  const f1Yes = safeDivide(2 * precisionYes * recallYes, precisionYes + recallYes)

  return {
    parse_success_rate: roundMetric(safeDivide(parseSuccess, executions.length)),
    decision_accuracy: roundMetric(safeDivide(exactDecisionMatches, executions.length)),
    precision_yes: roundMetric(precisionYes),
    recall_yes: roundMetric(recallYes),
    f1_yes: roundMetric(f1Yes),
    concern_match_rate: roundMetric(safeDivide(concernScoreTotal, concernScoreCases)),
    latency_ms_avg: roundMetric(safeDivide(sumLatency, withLatency)),
  }
}
