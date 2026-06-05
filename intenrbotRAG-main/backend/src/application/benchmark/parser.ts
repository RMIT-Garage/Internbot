import {
  checkerModelOutputSchema,
  faqModelOutputSchema,
  type BenchmarkFeature,
  type CheckerModelOutput,
  type FaqModelOutput,
} from './types'

function extractJsonObject(rawText: string): string | null {
  const first = rawText.indexOf('{')
  const last = rawText.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    return null
  }

  return rawText.slice(first, last + 1)
}

export function parseModelOutput(
  rawText: string,
  feature: BenchmarkFeature
):
  | { parsed: CheckerModelOutput | FaqModelOutput; parseSuccess: true }
  | { parsed: null; parseSuccess: false } {
  const jsonCandidate = extractJsonObject(rawText)
  if (!jsonCandidate) {
    return { parsed: null, parseSuccess: false }
  }

  let unknownParsed: unknown
  try {
    unknownParsed = JSON.parse(jsonCandidate)
  } catch {
    return { parsed: null, parseSuccess: false }
  }

  if (feature === 'faq-rag') {
    const validated = faqModelOutputSchema.safeParse(unknownParsed)
    if (!validated.success) {
      return { parsed: null, parseSuccess: false }
    }
    return { parsed: validated.data, parseSuccess: true }
  }

  const validated = checkerModelOutputSchema.safeParse(unknownParsed)
  if (!validated.success) {
    return { parsed: null, parseSuccess: false }
  }

  return { parsed: validated.data, parseSuccess: true }
}
