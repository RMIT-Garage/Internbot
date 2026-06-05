import type { BenchmarkFeature, BenchmarkMode } from './types'

export interface BenchmarkThresholdProfile {
  min?: Record<string, number>
  max?: Record<string, number>
}

interface FeatureModeConfig {
  datasetPath: string
  thresholds: BenchmarkThresholdProfile
}

const datasetRoot = 'benchmarks/datasets'

const benchmarkConfig: Record<BenchmarkFeature, Record<BenchmarkMode, FeatureModeConfig>> = {
  'contract-checker': {
    smoke: {
      datasetPath: `${datasetRoot}/contract-checker/smoke.json`,
      thresholds: {
        min: {
          parse_success_rate: 1,
          decision_accuracy: 0.8,
          precision_yes: 0.8,
          recall_yes: 0.8,
        },
      },
    },
    full: {
      datasetPath: `${datasetRoot}/contract-checker/full.json`,
      thresholds: {
        min: {
          parse_success_rate: 0.99,
          decision_accuracy: 0.85,
          precision_yes: 0.9,
          recall_yes: 0.8,
          usage_coverage_rate: 1,
        },
        max: {
          avg_cost_usd_per_call: 0.05,
        },
      },
    },
  },
  'job-checker': {
    smoke: {
      datasetPath: `${datasetRoot}/job-checker/smoke.json`,
      thresholds: {
        min: {
          parse_success_rate: 1,
          decision_accuracy: 0.8,
          precision_yes: 0.8,
          recall_yes: 0.8,
        },
      },
    },
    full: {
      datasetPath: `${datasetRoot}/job-checker/full.json`,
      thresholds: {
        min: {
          parse_success_rate: 0.99,
          decision_accuracy: 0.85,
          precision_yes: 0.88,
          recall_yes: 0.85,
          usage_coverage_rate: 1,
        },
        max: {
          avg_cost_usd_per_call: 0.03,
        },
      },
    },
  },
  'faq-rag': {
    smoke: {
      datasetPath: `${datasetRoot}/faq-rag/smoke.json`,
      thresholds: {
        min: {
          parse_success_rate: 1,
          answered_from_context_accuracy: 0.8,
          refusal_rate_unanswerable: 0.8,
          citation_presence_rate: 0.8,
          usage_coverage_rate: 0,
        },
      },
    },
    full: {
      datasetPath: `${datasetRoot}/faq-rag/full.json`,
      thresholds: {
        min: {
          parse_success_rate: 0.99,
          answered_from_context_accuracy: 0.9,
          refusal_rate_unanswerable: 0.9,
          citation_presence_rate: 0.9,
          usage_coverage_rate: 1,
        },
        max: {
          avg_cost_usd_per_call: 0.01,
        },
      },
    },
  },
}

export function getFeatureModeConfig(
  feature: BenchmarkFeature,
  mode: BenchmarkMode
): FeatureModeConfig {
  return benchmarkConfig[feature][mode]
}
