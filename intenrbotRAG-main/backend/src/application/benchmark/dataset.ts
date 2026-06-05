import * as fs from 'node:fs'
import * as path from 'node:path'
import { ValidationError } from '../../domain/errors'
import { benchmarkDatasetSchema, type BenchmarkDataset, type BenchmarkFeature } from './types'

export function loadDataset(feature: BenchmarkFeature, datasetPath: string): BenchmarkDataset {
  const absolutePath = path.resolve(process.cwd(), datasetPath)

  if (!fs.existsSync(absolutePath)) {
    throw new ValidationError(`Dataset file does not exist: ${absolutePath}`)
  }

  const raw = fs.readFileSync(absolutePath, 'utf8')
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new ValidationError(`Dataset is not valid JSON: ${absolutePath}`)
  }

  const validated = benchmarkDatasetSchema.safeParse(parsed)
  if (!validated.success) {
    const issue = validated.error.issues[0]
    throw new ValidationError(
      `Dataset validation failed at ${issue?.path.join('.') ?? 'unknown path'}: ${issue?.message ?? 'unknown error'}`
    )
  }

  if (validated.data.feature !== feature) {
    throw new ValidationError(
      `Dataset feature mismatch. Expected '${feature}', received '${validated.data.feature}' from ${absolutePath}`
    )
  }

  return validated.data
}
