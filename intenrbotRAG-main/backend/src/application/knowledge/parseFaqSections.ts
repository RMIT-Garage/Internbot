export interface FaqSection {
  section: string
  content: string
}

const SECTION_HEADING_PATTERN = /^\d+\.\s+.+$/

/**
 * Splits a student FAQ text file into numbered sections (e.g. "1. Eligibility and Enrolment").
 * Content before the first numbered heading is stored as section "Overview" when non-empty.
 */
export function parseFaqSections(raw: string): FaqSection[] {
  const lines = raw.split(/\r?\n/)
  const sections: FaqSection[] = []
  const preamble: string[] = []
  let currentHeading: string | null = null
  let currentBody: string[] = []

  const flushSection = (): void => {
    if (!currentHeading) return
    const content = currentBody.join('\n').trim()
    if (content) {
      sections.push({ section: currentHeading, content })
    }
    currentBody = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (SECTION_HEADING_PATTERN.test(trimmed)) {
      flushSection()
      currentHeading = trimmed
      continue
    }

    if (currentHeading) {
      currentBody.push(line)
    } else {
      preamble.push(line)
    }
  }

  flushSection()

  const intro = preamble.join('\n').trim()
  if (intro) {
    sections.unshift({ section: 'Overview', content: intro })
  }

  return sections
}
