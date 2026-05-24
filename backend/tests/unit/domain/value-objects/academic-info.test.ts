import { describe, it, expect } from 'vitest'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'

function buildAcademicInfo(
  overrides: Partial<{
    programName: string
    programLevel: 'undergraduate' | 'postgraduate'
    unitsAttempted: number
    creditUnitsEarned: number
    gpa: number
    currentStudyLoad: 'full_time' | 'part_time' | 'unknown'
    completedCourses: readonly string[] | undefined
    confirmedAt: Date | undefined
  }> = {}
): AcademicInfo {
  return AcademicInfo.rehydrate({
    programName: overrides.programName ?? 'Bachelor of Software Engineering',
    programLevel: overrides.programLevel ?? 'undergraduate',
    unitsAttempted: overrides.unitsAttempted ?? 192,
    creditUnitsEarned: overrides.creditUnitsEarned ?? 168,
    gpa: overrides.gpa ?? 3.2,
    currentStudyLoad: overrides.currentStudyLoad ?? 'full_time',
    programStatus: undefined,
    majors: undefined,
    minors: undefined,
    completedCourses: overrides.completedCourses,
    notes: undefined,
    confirmedAt: overrides.confirmedAt,
  })
}

describe('AcademicInfo', () => {
  describe('hasAllRequiredFields()', () => {
    it('returns true when all six required fields are present and valid', () => {
      expect(buildAcademicInfo().hasAllRequiredFields()).toBe(true)
    })

    it('returns false when programName is empty', () => {
      expect(buildAcademicInfo({ programName: '' }).hasAllRequiredFields()).toBe(false)
    })

    it('returns false when unitsAttempted is NaN', () => {
      expect(buildAcademicInfo({ unitsAttempted: NaN }).hasAllRequiredFields()).toBe(false)
    })

    it('returns false when gpa is NaN', () => {
      expect(buildAcademicInfo({ gpa: NaN }).hasAllRequiredFields()).toBe(false)
    })
  })

  describe('yearLevel', () => {
    it.each([
      [0, 1],
      [95, 1],
      [96, 2],
      [180, 2],
      [191, 2],
      [192, 3],
      [288, 4],
      [600, 4], // clamped to the 4-year program cap
    ])('derives year %i CP → year %i', (creditUnitsEarned, expected) => {
      expect(buildAcademicInfo({ creditUnitsEarned }).yearLevel).toBe(expected)
    })

    it('is not affected by majors/minors — only credit points', () => {
      expect(buildAcademicInfo({ creditUnitsEarned: 96 }).yearLevel).toBe(2)
    })
  })

  describe('completedCourses', () => {
    it('round-trips the attested course codes', () => {
      const ai = buildAcademicInfo({ completedCourses: ['SEF30012', 'APT40005'] })
      expect(ai.completedCourses).toEqual(['SEF30012', 'APT40005'])
    })

    it('defaults to undefined when not provided', () => {
      expect(buildAcademicInfo().completedCourses).toBeUndefined()
    })
  })

  describe('equals()', () => {
    it('returns true for structurally equal instances', () => {
      expect(buildAcademicInfo().equals(buildAcademicInfo())).toBe(true)
    })

    it('returns false when completedCourses differ', () => {
      const a = buildAcademicInfo({ completedCourses: ['SEF30012'] })
      const b = buildAcademicInfo({ completedCourses: ['APT40005'] })
      expect(a.equals(b)).toBe(false)
    })

    it('returns true when completedCourses match by value', () => {
      const a = buildAcademicInfo({ completedCourses: ['SEF30012', 'APT40005'] })
      const b = buildAcademicInfo({ completedCourses: ['SEF30012', 'APT40005'] })
      expect(a.equals(b)).toBe(true)
    })

    it('returns false when gpa differs', () => {
      expect(buildAcademicInfo({ gpa: 3.2 }).equals(buildAcademicInfo({ gpa: 3.3 }))).toBe(false)
    })

    it('treats two undefined confirmedAt values as equal', () => {
      const a = buildAcademicInfo({ confirmedAt: undefined })
      const b = buildAcademicInfo({ confirmedAt: undefined })
      expect(a.equals(b)).toBe(true)
    })

    it('returns false when one side has a confirmedAt and the other does not', () => {
      const a = buildAcademicInfo({ confirmedAt: new Date() })
      const b = buildAcademicInfo({ confirmedAt: undefined })
      expect(a.equals(b)).toBe(false)
    })

    it('treats equal Date instances as equal by value', () => {
      const d = new Date('2026-04-01T00:00:00Z')
      const a = buildAcademicInfo({ confirmedAt: d })
      const b = buildAcademicInfo({ confirmedAt: new Date('2026-04-01T00:00:00Z') })
      expect(a.equals(b)).toBe(true)
    })
  })

  describe('withConfirmedAt()', () => {
    it('returns a new instance with confirmedAt set, leaving other fields untouched', () => {
      const base = buildAcademicInfo()
      const stamped = base.withConfirmedAt(new Date('2026-04-01T00:00:00Z'))
      expect(stamped).not.toBe(base)
      expect(stamped.confirmedAt?.toISOString()).toBe('2026-04-01T00:00:00.000Z')
      expect(stamped.programName).toBe(base.programName)
      expect(stamped.gpa).toBe(base.gpa)
    })

    it('does not mutate the original instance', () => {
      const base = buildAcademicInfo()
      base.withConfirmedAt(new Date())
      expect(base.confirmedAt).toBeUndefined()
    })
  })
})
