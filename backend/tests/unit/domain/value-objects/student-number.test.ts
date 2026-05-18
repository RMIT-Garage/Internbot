import { describe, expect, it } from 'vitest'
import { parseStudentNumberFromEmail } from '../../../../src/domain/value-objects/student-number'

describe('parseStudentNumberFromEmail', () => {
  it('derives the student number from an RMIT student email', () => {
    expect(parseStudentNumberFromEmail('s1234567@student.rmit.edu.au')).toBe('s1234567')
  })

  it('normalizes email case before deriving the student number', () => {
    expect(parseStudentNumberFromEmail('S1234567@STUDENT.RMIT.EDU.AU')).toBe('s1234567')
  })

  it('returns null for non-student emails', () => {
    expect(parseStudentNumberFromEmail('student@example.com')).toBeNull()
    expect(parseStudentNumberFromEmail(undefined)).toBeNull()
  })
})
