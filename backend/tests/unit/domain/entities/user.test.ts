import { describe, it, expect } from 'vitest'
import { User } from '../../../../src/domain/entities/user'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'

function identityFor(uid: string): UserIdentity {
  return UserIdentity.rehydrate({
    provider: 'firebase',
    providerUserId: uid,
    emailSnapshot: undefined,
  })
}

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
    completedCourses: undefined,
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
    email: 's1@example.com',
    role: 'student',
    status: 'active',
    onboardingStage: 'profile_pending',
    identity: identityFor(`fb_${id}`),
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
    email: 'c@example.com',
    role: 'coordinator',
    status: 'active',
    onboardingStage: 'profile_complete',
    identity: identityFor(`fb_${id}`),
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

  describe('selectSemester()', () => {
    function completeStudent(): User {
      const u = buildStudent()
      u.changeProgramCode('BP096')
      u.setAcademicInfo(buildCompleteAcademic())
      return u
    }

    it('throws ConflictError(profile_incomplete) when profile is not complete', () => {
      const u = buildStudent()
      expect(() => u.selectSemester('sem_001', new Date('2026-04-01T00:00:00Z'))).toThrow(
        'Profile must be complete'
      )
    })

    it('writes semesterId on a complete profile', () => {
      const u = completeStudent()
      u.selectSemester('sem_001', new Date('2026-04-01T00:00:00Z'))
      expect(u.studentProfile?.semesterId).toBe('sem_001')
    })

    it('preserves semesterSelectedAt across re-selection', () => {
      const u = completeStudent()
      u.selectSemester('sem_001', new Date('2026-04-01T00:00:00Z'))
      const first = u.studentProfile?.semesterSelectedAt
      u.selectSemester('sem_002', new Date('2026-05-01T00:00:00Z'))
      expect(u.studentProfile?.semesterId).toBe('sem_002')
      expect(u.studentProfile?.semesterSelectedAt?.getTime()).toBe(first?.getTime())
    })

    it('throws ForbiddenError on coordinator', () => {
      expect(() =>
        buildCoordinator().selectSemester('sem_001', new Date('2026-04-01T00:00:00Z'))
      ).toThrow('Cannot edit a non-student user record')
    })
  })

  describe('User.create()', () => {
    const identity = UserIdentity.create({
      provider: 'firebase',
      providerUserId: 'fb_test',
      emailSnapshot: 'test@example.com',
    })

    it('throws when email is empty', () => {
      expect(() =>
        User.create({
          id: '',
          version: 0,
          email: '',
          role: 'student',
          status: 'active',
          onboardingStage: 'profile_pending',
          identity,
          createdAt: new Date(),
          updatedAt: new Date(),
          displayName: undefined,
          studentProfile: incompleteProfile(),
        })
      ).toThrow('email is required')
    })

    it('exposes the identity VO via getter on freshly-created aggregate', () => {
      const u = User.create({
        id: 'usr_001',
        version: 0,
        email: 'test@example.com',
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_pending',
        identity,
        createdAt: new Date(),
        updatedAt: new Date(),
        displayName: undefined,
        studentProfile: incompleteProfile(),
      })
      expect(u.identity).toBe(identity)
      expect(u.identity.provider).toBe('firebase')
      expect(u.identity.providerUserId).toBe('fb_test')
    })

    it('exposes the identity VO via getter on rehydrated aggregate', () => {
      const u = User.rehydrate({
        id: 'usr_001',
        version: 1,
        email: 'test@example.com',
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_pending',
        identity,
        createdAt: new Date(),
        updatedAt: new Date(),
        displayName: undefined,
        studentProfile: incompleteProfile(),
      })
      expect(u.identity).toBe(identity)
    })
  })
})
