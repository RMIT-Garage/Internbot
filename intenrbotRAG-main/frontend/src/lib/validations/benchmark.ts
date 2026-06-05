import { z } from 'zod'

export const benchmarkFeatureSchema = z.enum(['contract-checker', 'job-checker', 'faq-rag'])
export const benchmarkModeSchema = z.enum(['smoke', 'full'])

export const benchmarkSingleCaseSchema = z
  .object({
    feature: benchmarkFeatureSchema,
    mode: benchmarkModeSchema,
    caseId: z.string().trim().min(1, 'Case ID is required'),
    fixtures: z.boolean(),
    delayMs: z.number().int().min(0).max(10000).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.fixtures && (data.delayMs ?? 0) < 1000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['delayMs'],
        message: 'Use at least 1000ms delay for live mode to reduce 429 risk',
      })
    }
  })

export type BenchmarkSingleCaseInput = z.infer<typeof benchmarkSingleCaseSchema>
