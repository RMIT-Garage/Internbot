import { describe, expect, it } from 'vitest'
import { parseModelOutput } from '../../../../src/application/benchmark/parser'

describe('parseModelOutput', () => {
  it('parses checker JSON wrapped by prose', () => {
    const raw = `Result follows:\n{"scratchpad":"ok","decision":"Yes","confidence":0.9,"concerns":[],"summary":"pass"}`
    const result = parseModelOutput(raw, 'contract-checker')

    expect(result.parseSuccess).toBe(true)
    if (result.parseSuccess) {
      expect(result.parsed.decision).toBe('Yes')
    }
  })

  it('fails on invalid checker JSON schema', () => {
    const raw = '{"decision":"Maybe"}'
    const result = parseModelOutput(raw, 'job-checker')

    expect(result.parseSuccess).toBe(false)
  })

  it('parses faq output schema', () => {
    const raw =
      '{"answer":"A","sources":[{"title":"Doc","section":"S1"}],"confidence":0.8,"answered_from_context":true}'
    const result = parseModelOutput(raw, 'faq-rag')

    expect(result.parseSuccess).toBe(true)
    if (result.parseSuccess) {
      expect(result.parsed.answered_from_context).toBe(true)
    }
  })
})
