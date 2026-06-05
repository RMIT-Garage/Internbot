import { z } from 'zod'
import type { ModelUsage } from '../ports/modelProvider'

export const benchmarkFeatureSchema = z.enum(['contract-checker', 'job-checker', 'faq-rag'])
export type BenchmarkFeature = z.infer<typeof benchmarkFeatureSchema>

export const benchmarkModeSchema = z.enum(['smoke', 'full'])
export type BenchmarkMode = z.infer<typeof benchmarkModeSchema>

export const checkerDecisionSchema = z.enum(['Yes', 'No'])
export const checkerReasonCodeSchema = z.enum([
  'TECHNICAL_ALIGNMENT_INSUFFICIENT',
  'MIN_DURATION_OR_HOURS_UNCLEAR',
  'SUPERVISION_NOT_IDENTIFIABLE',
  'PAID_OR_FORMAL_STRUCTURE_MISSING',
  'EMPLOYER_LEGITIMACY_UNVERIFIED',
  'AWARD_CLASSIFICATION_UNCLEAR',
  'MINIMUM_HOURS_UNVERIFIED',
  'IDENTITY_MISMATCH_OR_MISSING',
  'SUBSTANTIVE_TECHNICAL_WORK_UNVERIFIED',
  'CONTRACT_VALIDITY_RISK',
  'MISSING_LINKED_DOCUMENT',
  'WEB_EVIDENCE_CONFLICT',
  'INSUFFICIENT_EVIDENCE',
])

export const checkerModelOutputSchema = z.object({
  scratchpad: z.string(),
  decision: checkerDecisionSchema,
  confidence: z.number().min(0).max(1),
  concerns: z.array(z.string()),
  reasonCodes: z.array(checkerReasonCodeSchema).default([]),
  summary: z.string(),
})
export type CheckerModelOutput = z.infer<typeof checkerModelOutputSchema>

export const faqSourceSchema = z.object({
  title: z.string(),
  section: z.string(),
  url: z.string().url().optional(),
})

export const faqModelOutputSchema = z.object({
  answer: z.string(),
  sources: z.array(faqSourceSchema),
  confidence: z.number().min(0).max(1),
  answered_from_context: z.boolean(),
})
export type FaqModelOutput = z.infer<typeof faqModelOutputSchema>

const checkerCaseBaseSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  input: z.object({
    text: z.string().min(1),
  }),
  expected: z.object({
    decision: checkerDecisionSchema,
    failingRules: z.array(z.string()).default([]),
    concerns: z.array(z.string()).default([]),
  }),
})

export const contractCheckerCaseSchema = checkerCaseBaseSchema.extend({
  feature: z.literal('contract-checker'),
  fixtureResponse: checkerModelOutputSchema.optional(),
})
export type ContractCheckerCase = z.infer<typeof contractCheckerCaseSchema>

export const jobCheckerCaseSchema = checkerCaseBaseSchema.extend({
  feature: z.literal('job-checker'),
  fixtureResponse: checkerModelOutputSchema.optional(),
})
export type JobCheckerCase = z.infer<typeof jobCheckerCaseSchema>

export const faqCaseSchema = z.object({
  id: z.string().min(1),
  feature: z.literal('faq-rag'),
  name: z.string().min(1),
  input: z.object({
    question: z.string().min(1),
    retrievedChunks: z.array(
      z.object({
        title: z.string(),
        section: z.string(),
        text: z.string(),
      })
    ),
  }),
  expected: z.object({
    answeredFromContext: z.boolean(),
    refusalMessage: z.string().optional(),
    requiredSources: z.array(faqSourceSchema).default([]),
  }),
  fixtureResponse: faqModelOutputSchema.optional(),
})
export type FaqCase = z.infer<typeof faqCaseSchema>

export const benchmarkCaseSchema = z.discriminatedUnion('feature', [
  contractCheckerCaseSchema,
  jobCheckerCaseSchema,
  faqCaseSchema,
])
export type BenchmarkCase = z.infer<typeof benchmarkCaseSchema>

export const benchmarkDatasetSchema = z
  .object({
    datasetVersion: z.string().min(1),
    feature: benchmarkFeatureSchema,
    promptVersion: z.string().min(1),
    model: z.string().min(1),
    cases: z.array(benchmarkCaseSchema),
  })
  .refine((dataset) => dataset.cases.every((testCase) => testCase.feature === dataset.feature), {
    message: 'All cases in a dataset must match dataset.feature',
  })

export type BenchmarkDataset = z.infer<typeof benchmarkDatasetSchema>

export interface BenchmarkCaseExecution {
  caseId: string
  name: string
  feature: BenchmarkFeature
  expected: ContractCheckerCase['expected'] | JobCheckerCase['expected'] | FaqCase['expected']
  rawResponse: string
  parsedResponse: CheckerModelOutput | FaqModelOutput | null
  parseSuccess: boolean
  latencyMs: number
  usage?: ModelUsage
  estimatedCostUsd?: number
  error?: string
}

export interface BenchmarkRunMetadata {
  runId: string
  mode: BenchmarkMode
  feature: BenchmarkFeature
  provider: string
  model: string
  promptVersion: string
  promptPath: string
  startedAtIso: string
  finishedAtIso: string
  usedFixtureResponses: boolean
}

export interface BenchmarkRunResult {
  metadata: BenchmarkRunMetadata
  executions: BenchmarkCaseExecution[]
  metrics: Record<string, number>
  minThresholds: Record<string, number>
  maxThresholds: Record<string, number>
  pass: boolean
}
