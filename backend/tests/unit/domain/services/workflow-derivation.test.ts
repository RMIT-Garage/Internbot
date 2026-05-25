import { describe, it, expect } from 'vitest'
import { User } from '../../../../src/domain/entities/user'
import { Semester } from '../../../../src/domain/entities/semester'
import { Internship } from '../../../../src/domain/entities/internship'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { AcademicInfo } from '../../../../src/domain/value-objects/academic-info'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import type { InternshipStatus } from '../../../../src/domain/value-objects/internship-enums'

function identityFor(uid: string): UserIdentity {
  return UserIdentity.rehydrate({
    provider: 'firebase',
    providerUserId: uid,
    emailSnapshot: undefined,
  })
}
import { deriveWorkflowState } from '../../../../src/domain/services/workflow-derivation'

const NOW = new Date('2026-04-01T00:00:00Z')

function completeProfile(semesterId?: string, semesterSelectedAt?: Date): StudentProfile {
  return StudentProfile.rehydrate({
    studentNumber: 's1234567',
    profileStatus: 'complete',
    programCode: 'BP096',
    phone: undefined,
    academicInfo: AcademicInfo.rehydrate({
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
      confirmedAt: NOW,
    }),
    semesterId,
    semesterSelectedAt,
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

function buildStudent(profile: StudentProfile): User {
  return User.rehydrate({
    id: 'usr_test',
    version: 1,
    email: 's@example.com',
    role: 'student',
    status: 'active',
    onboardingStage: profile.profileStatus === 'complete' ? 'profile_complete' : 'profile_pending',
    identity: identityFor('fb_test'),
    createdAt: NOW,
    updatedAt: NOW,
    displayName: undefined,
    studentProfile: profile,
  })
}

function buildSemester(
  opts: {
    status?: 'draft' | 'enrollment_open' | 'placement_running' | 'reporting' | 'archived'
  } = {}
): Semester {
  return Semester.rehydrate({
    id: 'sem_001',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Sem 1 2026',
    status: opts.status ?? 'enrollment_open',
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

function buildInternship(status: InternshipStatus): Internship {
  return Internship.rehydrate({
    id: `int_${status}`,
    version: 1,
    userId: 'usr_test',
    opportunityId: 'opp_001',
    semesterId: 'sem_001',
    offerDate: undefined,
    startDate: undefined,
    endDate: undefined,
    status,
    coordinatorDecision: undefined,
    coordinatorComment: undefined,
    reviewedByUserId: undefined,
    reviewedAt: undefined,
    lastSubmittedAt: undefined,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

describe('deriveWorkflowState', () => {
  it('incomplete profile → profile / no_semester / not_enrolled', () => {
    const state = deriveWorkflowState(buildStudent(incompleteProfile()), undefined, NOW)
    expect(state).toEqual({
      currentWorkflowStep: 'profile',
      internshipStatus: 'no_semester',
      semesterEnrolmentState: 'not_enrolled',
    })
  })

  it('complete profile, no semester → semester_selection / no_semester / not_enrolled', () => {
    const state = deriveWorkflowState(buildStudent(completeProfile()), undefined, NOW)
    expect(state).toEqual({
      currentWorkflowStep: 'semester_selection',
      internshipStatus: 'no_semester',
      semesterEnrolmentState: 'not_enrolled',
    })
  })

  it('complete profile + enrollment_open semester → opportunity_browsing / browsing_opportunities / enrolled', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester({ status: 'enrollment_open' }),
      NOW
    )
    expect(state.currentWorkflowStep).toBe('opportunity_browsing')
    expect(state.internshipStatus).toBe('browsing_opportunities')
    expect(state.semesterEnrolmentState).toBe('enrolled')
  })

  it('complete profile + placement_running semester → window_closed', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester({ status: 'placement_running' }),
      NOW
    )
    expect(state.semesterEnrolmentState).toBe('window_closed')
  })

  it('complete profile + reporting semester → window_closed', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester({ status: 'reporting' }),
      NOW
    )
    expect(state.semesterEnrolmentState).toBe('window_closed')
  })

  it('semester reference dangling (semesterId set but semester not loaded) → not_enrolled', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_missing', NOW)),
      undefined,
      NOW
    )
    expect(state.semesterEnrolmentState).toBe('not_enrolled')
    expect(state.currentWorkflowStep).toBe('opportunity_browsing')
  })

  it('offer_pending_review internship → offer_stage / offer_in_review', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester(),
      NOW,
      [buildInternship('offer_pending_review')]
    )
    expect(state.currentWorkflowStep).toBe('offer_stage')
    expect(state.internshipStatus).toBe('offer_in_review')
  })

  it('offer_changes_requested outranks applied/rejected internships', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester(),
      NOW,
      [
        buildInternship('applied'),
        buildInternship('rejected'),
        buildInternship('offer_changes_requested'),
      ]
    )
    expect(state.currentWorkflowStep).toBe('offer_stage')
    expect(state.internshipStatus).toBe('offer_changes_requested')
  })

  it('offer_approved internship → completed / offer_approved', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester(),
      NOW,
      [buildInternship('offer_pending_review'), buildInternship('offer_approved')]
    )
    expect(state.currentWorkflowStep).toBe('completed')
    expect(state.internshipStatus).toBe('offer_approved')
  })

  it('all rejected internships → opportunity_browsing / all_rejected', () => {
    const state = deriveWorkflowState(
      buildStudent(completeProfile('sem_001', NOW)),
      buildSemester(),
      NOW,
      [buildInternship('rejected')]
    )
    expect(state.currentWorkflowStep).toBe('opportunity_browsing')
    expect(state.internshipStatus).toBe('all_rejected')
  })

  it('throws when called on a coordinator', () => {
    const coord = User.rehydrate({
      id: 'usr_coord',
      version: 1,
      email: 'c@example.com',
      role: 'coordinator',
      status: 'active',
      onboardingStage: 'profile_complete',
      identity: identityFor('fb_coord'),
      createdAt: NOW,
      updatedAt: NOW,
      displayName: undefined,
      studentProfile: undefined,
    })
    expect(() => deriveWorkflowState(coord, undefined, NOW)).toThrow(
      'deriveWorkflowState may only be called on a student user'
    )
  })
})
