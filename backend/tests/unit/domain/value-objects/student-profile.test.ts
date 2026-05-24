import { describe, it, expect } from 'vitest'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'

function buildCompleteAcademic(): AcademicInfo {
  return AcademicInfo.rehydrate({
    programName: 'Bachelor of Software Engineering',
    programLevel: 'undergraduate',
    unitsAttempted: 192,
    creditUnitsEarned: 168,
    gpa: 3.2,
    currentStudyLoad: 'full_time',
    programStatus: undefined,
    majors: undefined,
    minors: undefined,
    completedCourses: undefined,
    notes: undefined,
    confirmedAt: undefined,
  })
}

function buildProfile(
  overrides: Partial<{
    studentNumber: string
    profileStatus: 'incomplete' | 'complete'
    programCode: string | undefined
    phone: string | undefined
    academicInfo: AcademicInfo | undefined
    semesterId: string | undefined
    semesterSelectedAt: Date | undefined
  }> = {}
): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: overrides.studentNumber ?? 's1234567',
    profileStatus: overrides.profileStatus ?? 'incomplete',
    programCode: 'programCode' in overrides ? overrides.programCode : 'BP096',
    phone: 'phone' in overrides ? overrides.phone : undefined,
    academicInfo: 'academicInfo' in overrides ? overrides.academicInfo : buildCompleteAcademic(),
    semesterId: 'semesterId' in overrides ? overrides.semesterId : undefined,
    semesterSelectedAt:
      'semesterSelectedAt' in overrides ? overrides.semesterSelectedAt : undefined,
  })
}

describe('StudentProfile', () => {
  describe('isComplete()', () => {
    it('returns true when studentNumber, programCode and a complete academicInfo are present', () => {
      expect(buildProfile().isComplete()).toBe(true)
    })

    it('returns false when programCode is missing', () => {
      expect(buildProfile({ programCode: undefined }).isComplete()).toBe(false)
    })

    it('returns false when academicInfo is missing', () => {
      expect(buildProfile({ academicInfo: undefined }).isComplete()).toBe(false)
    })

    it('returns false when academicInfo is present but incomplete', () => {
      const bad = AcademicInfo.rehydrate({
        programName: '',
        programLevel: 'undergraduate',
        unitsAttempted: 0,
        creditUnitsEarned: 0,
        gpa: 0,
        currentStudyLoad: 'full_time',
        programStatus: undefined,
        majors: undefined,
        minors: undefined,
        completedCourses: undefined,
        notes: undefined,
        confirmedAt: undefined,
      })
      expect(buildProfile({ academicInfo: bad }).isComplete()).toBe(false)
    })
  })

  describe('deriveStatus()', () => {
    it('derives "complete" when isComplete() is true', () => {
      expect(buildProfile().deriveStatus()).toBe('complete')
    })

    it('derives "incomplete" when isComplete() is false', () => {
      expect(buildProfile({ programCode: undefined }).deriveStatus()).toBe('incomplete')
    })
  })

  describe('withProgramCode()', () => {
    it('returns a new instance with programCode set, preserving everything else', () => {
      const base = buildProfile({ programCode: 'BP096' })
      const next = base.withProgramCode('BP347')
      expect(next).not.toBe(base)
      expect(next.programCode).toBe('BP347')
      expect(next.studentNumber).toBe(base.studentNumber)
    })
  })

  describe('withPhone()', () => {
    it('can clear the phone by passing undefined', () => {
      const base = buildProfile({ phone: '0400000000' })
      const cleared = base.withPhone(undefined)
      expect(cleared.phone).toBeUndefined()
    })
  })

  describe('withAcademicInfo()', () => {
    it('replaces the academicInfo', () => {
      const replaced = buildCompleteAcademic().withConfirmedAt(new Date('2026-04-01T00:00:00Z'))
      const base = buildProfile()
      const next = base.withAcademicInfo(replaced)
      expect(next.academicInfo).toBe(replaced)
    })
  })

  describe('withProfileStatus()', () => {
    it('overrides profileStatus on a new instance', () => {
      const base = buildProfile({ profileStatus: 'incomplete' })
      expect(base.withProfileStatus('complete').profileStatus).toBe('complete')
    })
  })

  describe('markComplete()', () => {
    const now = new Date('2026-04-22T10:00:00Z')

    it('stamps confirmedAt and sets profileStatus=complete on first completion', () => {
      const base = buildProfile({ profileStatus: 'incomplete' })
      const next = base.markComplete(now)
      expect(next.profileStatus).toBe('complete')
      expect(next.academicInfo?.confirmedAt?.getTime()).toBe(now.getTime())
    })

    it('is idempotent — keeps the original confirmedAt on re-entry', () => {
      const original = new Date('2026-04-01T00:00:00Z')
      const base = buildProfile({
        profileStatus: 'complete',
        academicInfo: buildCompleteAcademic().withConfirmedAt(original),
      })
      const next = base.markComplete(now)
      expect(next.academicInfo?.confirmedAt?.getTime()).toBe(original.getTime())
    })

    it('throws when the profile does not satisfy isComplete()', () => {
      const base = buildProfile({ programCode: undefined })
      expect(() => base.markComplete(now)).toThrow(
        'Cannot markComplete: profile does not satisfy isComplete()'
      )
    })
  })

  describe('withSemester()', () => {
    it('sets semesterId and semesterSelectedAt on first call', () => {
      const now = new Date('2026-03-01T00:00:00Z')
      const next = buildProfile({
        semesterId: undefined,
        semesterSelectedAt: undefined,
      }).withSemester('sem_abc', now)
      expect(next.semesterId).toBe('sem_abc')
      expect(next.semesterSelectedAt).toBe(now)
    })

    it('preserves the original semesterSelectedAt on re-enrolment', () => {
      const original = new Date('2026-03-01T00:00:00Z')
      const later = new Date('2026-06-01T00:00:00Z')
      const base = buildProfile({ semesterId: 'sem_old', semesterSelectedAt: original })
      const next = base.withSemester('sem_new', later)
      expect(next.semesterId).toBe('sem_new')
      expect(next.semesterSelectedAt).toBe(original)
    })
  })
})
