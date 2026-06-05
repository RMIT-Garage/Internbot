import { describe, expect, it } from 'vitest'
import { parseFaqSections } from '../../../../src/application/knowledge/parseFaqSections'

describe('parseFaqSections', () => {
  it('splits numbered FAQ headings into sections', () => {
    const raw = `Intro line about internships.

1. Eligibility and Enrolment
Question one?
Answer one.

2. Internship Duration
How long?
40 weeks minimum.`

    const sections = parseFaqSections(raw)

    expect(sections.length).toBeGreaterThanOrEqual(2)
    expect(sections.some((s) => s.section === '1. Eligibility and Enrolment')).toBe(true)
    expect(sections.some((s) => s.section === '2. Internship Duration')).toBe(true)
    const eligibility = sections.find((s) => s.section === '1. Eligibility and Enrolment')
    expect(eligibility?.content).toContain('Answer one')
  })
})
