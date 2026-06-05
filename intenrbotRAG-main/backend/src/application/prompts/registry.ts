import * as fs from 'node:fs'
import * as path from 'node:path'
import { ValidationError } from '../../domain/errors'
import type { BenchmarkFeature } from '../benchmark/types'

interface PromptConfig {
  version: string
  path: string
}

const benchmarkRoot = path.resolve(process.cwd(), 'benchmarks/prompts')

const promptRegistry: Record<BenchmarkFeature, PromptConfig> = {
  'contract-checker': {
    version: 'v1.3.1',
    path: path.join(benchmarkRoot, 'contract-checker', 'v1.3.1.txt'),
  },
  'job-checker': {
    version: 'v1.3.0',
    path: path.join(benchmarkRoot, 'job-checker', 'v1.3.0.txt'),
  },
  'faq-rag': {
    version: 'v1.1.0',
    path: path.join(benchmarkRoot, 'faq-rag', 'v1.1.0.txt'),
  },
}

export interface PromptMaterial {
  version: string
  path: string
  content: string
}

export function getPromptMaterial(feature: BenchmarkFeature): PromptMaterial {
  const config = promptRegistry[feature]
  const content = readPromptFile(config.path)
  return {
    version: config.version,
    path: config.path,
    content,
  }
}

function readPromptFile(promptPath: string): string {
  if (!fs.existsSync(promptPath)) {
    throw new ValidationError(`Prompt file does not exist: ${promptPath}`)
  }

  const content = fs.readFileSync(promptPath, 'utf8').trim()
  if (content.length === 0) {
    throw new ValidationError(`Prompt file is empty: ${promptPath}`)
  }

  return content
}
