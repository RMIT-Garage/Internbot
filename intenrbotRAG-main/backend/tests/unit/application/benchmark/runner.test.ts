import { describe, expect, it } from 'vitest'
import { runBenchmark } from '../../../../src/application/benchmark/runner'
import type { ModelProvider } from '../../../../src/application/ports/modelProvider'

const fixtureProvider: ModelProvider = {
  name: 'fixture-provider',
  async generateText() {
    return { rawText: '' }
  },
}

describe('runBenchmark', () => {
  it('runs smoke benchmark with fixture responses for checker', async () => {
    const result = await runBenchmark({
      feature: 'contract-checker',
      mode: 'smoke',
      provider: fixtureProvider,
      model: 'gemini-2.0-flash-lite',
      useFixtureResponses: true,
    })

    expect(result.metadata.feature).toBe('contract-checker')
    expect(result.executions.length).toBeGreaterThan(0)
    expect(result.metrics.parse_success_rate).toBeGreaterThan(0)
  })

  it('runs smoke benchmark with fixture responses for faq', async () => {
    const result = await runBenchmark({
      feature: 'faq-rag',
      mode: 'smoke',
      provider: fixtureProvider,
      model: 'gemini-2.0-flash-lite',
      useFixtureResponses: true,
    })

    expect(result.metadata.feature).toBe('faq-rag')
    expect(result.executions.length).toBeGreaterThan(0)
    expect(result.metrics.parse_success_rate).toBeGreaterThan(0)
  })
})
