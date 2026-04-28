import { describe, it, expect } from 'vitest'
import { GetUserWorkflowQueryHandler } from '../../../../src/application/queries/get-user-workflow'
import { User } from '../../../../src/domain/entities/user'
import { Semester } from '../../../../src/domain/entities/semester'
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
import { buildMockUow, buildRequestActor, buildPlatformUser } from '../../../setup.unit'

const NOW = new Date('2026-04-01T00:00:00Z')

function completeProfile(semesterId?: string): StudentProfile {
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
      notes: undefined,
      confirmedAt: NOW,
    }),
    semesterId,
    semesterSelectedAt: semesterId ? NOW : undefined,
  })
}

function buildStudent(profile = completeProfile()): User {
  return User.rehydrate({
    id: 'usr_student',
    version: 1,
    email: 's@example.com',
    role: 'student',
    status: 'active',
    onboardingStage: 'profile_complete',
    identity: identityFor('fb_student'),
    createdAt: NOW,
    updatedAt: NOW,
    displayName: undefined,
    studentProfile: profile,
  })
}

function buildCoordinator(): User {
  return User.rehydrate({
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
}

function buildSemester(): Semester {
  return Semester.rehydrate({
    id: 'sem_001',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Sem 1',
    status: 'active',
    enrolmentOpenAt: new Date('2026-03-01T00:00:00Z'),
    enrolmentCloseAt: new Date('2026-05-01T00:00:00Z'),
    createdAt: NOW,
    updatedAt: NOW,
  })
}

describe('GetUserWorkflowQueryHandler', () => {
  it('rejects pre-sync caller with no_platform_user', async () => {
    const { uow } = buildMockUow()
    const handler = new GetUserWorkflowQueryHandler(uow)
    await expect(
      handler.handle({ actor: buildRequestActor({ platformUser: null }), userId: 'usr_student' })
    ).rejects.toMatchObject({ reason: 'no_platform_user' })
  })

  it('student reading another student → student_not_owner', async () => {
    const { uow } = buildMockUow()
    const handler = new GetUserWorkflowQueryHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_a', role: 'student' }),
        }),
        userId: 'usr_b',
      })
    ).rejects.toMatchObject({ reason: 'student_not_owner' })
  })

  it('coordinator may read any student', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    const handler = new GetUserWorkflowQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
      }),
      userId: 'usr_student',
    })
    expect(result.workflow.currentWorkflowStep).toBe('semester_selection')
  })

  it('NotFoundError when target user is missing', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(null)
    const handler = new GetUserWorkflowQueryHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        userId: 'usr_student',
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('NotFoundError when target is a coordinator (sub-resource does not exist)', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildCoordinator())
    const handler = new GetUserWorkflowQueryHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
        }),
        userId: 'usr_coord',
      })
    ).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  it('hydrates referenced semester for window state', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent(completeProfile('sem_001')))
    semesters.findById.mockResolvedValueOnce(buildSemester())
    const handler = new GetUserWorkflowQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
      }),
      userId: 'usr_student',
    })
    expect(result.workflow.currentWorkflowStep).toBe('opportunity_browsing')
    expect(result.workflow.semesterEnrolmentState).toBe('enrolled')
  })

  it('skips semester lookup when no semesterId is set', async () => {
    const { uow, users, semesters } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    const handler = new GetUserWorkflowQueryHandler(uow)
    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
      }),
      userId: 'usr_student',
    })
    expect(result.workflow.currentWorkflowStep).toBe('semester_selection')
    expect(semesters.findById).not.toHaveBeenCalled()
  })
})
