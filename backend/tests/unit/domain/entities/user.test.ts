import { describe, it, expect } from 'vitest'
import { User } from '../../../../src/domain/entities/user'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'

function buildCompleteAcademic(): AcademicInfo {
  return AcademicInfo.rehydrate({
    programName: 'Bachelor of SE',
    programLevel: 'undergraduate',
    unitsAttempted: 192,
    creditUnitsEarned: 168,
    gpa: 3.2,
    currentStudyLoad: 'full_time',
    programStatus: undefined,
    majors: undefined,
    minors: undefined,
    notes: undefined,
    confirmedAt: undefined,
  })
}

function incompleteProfile(): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: 's1234567',
    profileStatus: 'incomplete',
    programCode: undefined,
    phone: undefined,
    academicInfo: undefined,
    semesterId: undefined,
    semesterSelectedAt: undefined,
  })
}

function buildStudent(id = 'usr_abc', profile?: StudentProfile): User {
  return User.rehydrate({
    id,
    version: 1,
    firebaseUid: 'fb_uid',
    email: 's1@example.com',
    role: 'student',
    status: 'active',
    onboardingStage: 'profile_pending',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    displayName: undefined,
    studentProfile: profile ?? incompleteProfile(),
  })
}

function buildCoordinator(id = 'usr_coord'): User {
  return User.rehydrate({
    id,
    version: 1,
    firebaseUid: 'fb_coord',
    email: 'c@example.com',
    role: 'coordinator',
    status: 'active',
    onboardingStage: 'profile_complete',
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
    displayName: undefined,
    studentProfile: undefined,
  })
}

describe('User', () => {
  describe('isStudent()', () => {
    it('returns true for a student user with a studentProfile', () => {
      expect(buildStudent().isStudent()).toBe(true)
    })

    it('returns false for a coordinator', () => {
      expect(buildCoordinator().isStudent()).toBe(false)
    })
  })

  describe('isCoordinator() / isOwnedBy()', () => {
    it('isCoordinator() returns true for a coordinator', () => {
      expect(buildCoordinator().isCoordinator()).toBe(true)
    })

    it('isOwnedBy returns true on id match', () => {
      expect(buildStudent('usr_me').isOwnedBy('usr_me')).toBe(true)
    })

    it('isOwnedBy returns false on id mismatch', () => {
      expect(buildStudent('usr_me').isOwnedBy('usr_other')).toBe(false)
    })
  })

  describe('changeDisplayName()', () => {
    it('updates displayName in place', () => {
      const u = buildStudent()
      u.changeDisplayName('Alex Chen')
      expect(u.displayName).toBe('Alex Chen')
    })

    it('is a no-op on same value', () => {
      const u = buildStudent()
      u.changeDisplayName('Alex Chen')
      u.changeDisplayName('Alex Chen')
      expect(u.displayName).toBe('Alex Chen')
    })

    it('can clear displayName by passing undefined', () => {
      const u = buildStudent()
      u.changeDisplayName('Alex')
      u.changeDisplayName(undefined)
      expect(u.displayName).toBeUndefined()
    })
  })

  describe('student-only mutations', () => {
    it('changePhone sets phone and syncs onboarding stage on incomplete profile', () => {
      const u = buildStudent()
      u.changePhone('0400000000')
      expect(u.studentProfile?.phone).toBe('0400000000')
      expect(u.onboardingStage).toBe('profile_pending')
    })

    it('changePhone throws ForbiddenError on a coordinator', () => {
      expect(() => buildCoordinator().changePhone('0400000000')).toThrow(
        'Cannot edit a non-student user record'
      )
    })

    it('clearPhone is a no-op when phone is already undefined', () => {
      const u = buildStudent()
      const before = u.studentProfile
      u.clearPhone()
      expect(u.studentProfile).toBe(before)
    })

    it('setAcademicInfo transitions to profile_complete and stamps confirmedAt on first complete', () => {
      const u = buildStudent()
      u.changeProgramCode('BP096')
      u.setAcademicInfo(buildCompleteAcademic())
      expect(u.studentProfile?.profileStatus).toBe('complete')
      expect(u.onboardingStage).toBe('profile_complete')
      expect(u.studentProfile?.academicInfo?.confirmedAt).toBeInstanceOf(Date)
    })

    it('setAcademicInfo preserves confirmedAt on re-writes', () => {
      const u = buildStudent()
      u.changeProgramCode('BP096')
      u.setAcademicInfo(buildCompleteAcademic())
      const first = u.studentProfile?.academicInfo?.confirmedAt
      u.setAcademicInfo(buildCompleteAcademic())
      const second = u.studentProfile?.academicInfo?.confirmedAt
      expect(second?.getTime()).toBe(first?.getTime())
    })

    it('clearAcademicInfo returns profile to incomplete', () => {
      const u = buildStudent()
      u.changeProgramCode('BP096')
      u.setAcademicInfo(buildCompleteAcademic())
      expect(u.studentProfile?.profileStatus).toBe('complete')
      u.clearAcademicInfo()
      expect(u.studentProfile?.profileStatus).toBe('incomplete')
      expect(u.studentProfile?.academicInfo).toBeUndefined()
      expect(u.onboardingStage).toBe('profile_pending')
    })
  })

  describe('ensureStudentNumberMatches()', () => {
    it('no-op on same value', () => {
      const u = buildStudent()
      expect(() => u.ensureStudentNumberMatches('s1234567')).not.toThrow()
    })

    it('no-op on undefined', () => {
      const u = buildStudent()
      expect(() => u.ensureStudentNumberMatches(undefined)).not.toThrow()
    })

    it('throws ValidationError with immutable_field on different value', () => {
      const u = buildStudent()
      expect(() => u.ensureStudentNumberMatches('s9999999')).toThrow(
        'studentNumber is immutable after first sync'
      )
    })
  })

  describe('User.create()', () => {
    it('throws when firebaseUid is empty', () => {
      expect(() =>
        User.create({
          id: '',
          version: 0,
          firebaseUid: '',
          email: 'x@y.z',
          role: 'student',
          status: 'active',
          onboardingStage: 'profile_pending',
          createdAt: new Date(),
          updatedAt: new Date(),
          displayName: undefined,
          studentProfile: incompleteProfile(),
        })
      ).toThrow('firebaseUid is required')
    })
  })
})
