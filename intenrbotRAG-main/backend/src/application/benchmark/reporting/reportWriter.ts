import * as fs from 'node:fs'
import * as path from 'node:path'
import type { BenchmarkRunResult } from '../types'

interface ReportPaths {
  jsonPath: string
  markdownPath: string
}

const reportsRoot = path.resolve(process.cwd(), 'benchmarks/reports')

function formatDate(value: string): string {
  return new Date(value).toISOString()
}

function getStatusText(pass: boolean): string {
  return pass ? 'PASS' : 'FAIL'
}

function formatThreshold(
  metricKey: string,
  result: BenchmarkRunResult
): { text: string; pass: boolean } {
  const min = result.minThresholds[metricKey]
  const max = result.maxThresholds[metricKey]
  const value = result.metrics[metricKey] ?? 0

  if (typeof min === 'number') {
    return {
      text: `min ${min}`,
      pass: value >= min,
    }
  }

  if (typeof max === 'number') {
    return {
      text: `max ${max}`,
      pass: value <= max,
    }
  }

  return {
    text: 'n/a',
    pass: true,
  }
}

function serializeMarkdown(result: BenchmarkRunResult): string {
  const metricLines = Object.entries(result.metrics)
    .map(([key, value]) => {
      const threshold = formatThreshold(key, result)
      const verdict = threshold.pass ? 'PASS' : 'FAIL'
      return `- ${key}: ${value} (${threshold.text}, ${verdict})`
    })
    .join('\n')

  const minThresholdLines = Object.entries(result.minThresholds)
    .map(([key, value]) => `- ${key}: >= ${value}`)
    .join('\n')
  const maxThresholdLines = Object.entries(result.maxThresholds)
    .map(([key, value]) => `- ${key}: <= ${value}`)
    .join('\n')

  return [
    `# Benchmark Report — ${result.metadata.feature}`,
    '',
    `- Run ID: ${result.metadata.runId}`,
    `- Status: ${getStatusText(result.pass)}`,
    `- Mode: ${result.metadata.mode}`,
    `- Provider: ${result.metadata.provider}`,
    `- Model: ${result.metadata.model}`,
    `- Prompt version: ${result.metadata.promptVersion}`,
    `- Prompt path: ${result.metadata.promptPath}`,
    `- Started: ${formatDate(result.metadata.startedAtIso)}`,
    `- Finished: ${formatDate(result.metadata.finishedAtIso)}`,
    `- Fixture responses: ${result.metadata.usedFixtureResponses ? 'yes' : 'no'}`,
    '',
    '## Thresholds (min)',
    minThresholdLines || '- none',
    '',
    '## Thresholds (max)',
    maxThresholdLines || '- none',
    '',
    '## Metrics',
    metricLines,
    '',
    '## Case count',
    `- Total: ${result.executions.length}`,
  ].join('\n')
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

export function writeBenchmarkReport(result: BenchmarkRunResult): ReportPaths {
  ensureDir(reportsRoot)

  const base = `${result.metadata.feature}-${result.metadata.mode}-${result.metadata.runId}`
  const jsonPath = path.join(reportsRoot, `${base}.json`)
  const markdownPath = path.join(reportsRoot, `${base}.md`)

  fs.writeFileSync(jsonPath, JSON.stringify(result, null, 2), 'utf8')
  fs.writeFileSync(markdownPath, serializeMarkdown(result), 'utf8')

  return { jsonPath, markdownPath }
}
