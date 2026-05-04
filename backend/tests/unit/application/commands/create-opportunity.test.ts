import { describe, expect, it } from 'vitest'
import { CreateOpportunityCommandHandler } from '../../../../src/application/commands/create-opportunity'
import { Semester } from '../../../../src/domain/entities/semester'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import {
  buildMockIdGenerator,
  buildMockUow,
  buildPlatformUser,
  buildRequestActor,
} from '../../../setup.unit'

const validPayload = {
  semesterId: 'sem_active',
  type: 'pre_approved' as const,
  employerName: 'Example Pty Ltd',
  jobTitle: 'Software Intern',
  descriptionText: 'Build software',
  workMode: undefined,
  location: undefined,
  sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
}

function buildSemester(status: 'draft' | 'active' | 'archived' = 'active') {
  const now = new Date('2026-04-01T00:00:00Z')
  return Semester.rehydrate({
    id: 'sem_active',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Semester',
    status,
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
}

function buildStudentWithSemester() {
  const now = new Date('2026-04-01T00:00:00Z')
  return User.rehydrate({
    id: 'usr_student',
    version: 1,
    email: 's123@student.rmit.edu.au',
    role: 'student',
    status: 'active',
    onboardingStage: 'profile_complete',
    identity: UserIdentity.rehydrate({ provider: 'firebase', providerUserId: 'fb' }),
    createdAt: now,
    updatedAt: now,
    displayName: undefined,
    studentProfile: StudentProfile.rehydrate({
      studentNumber: 's123',
      profileStatus: 'complete',
      programCode: 'BP096',
      phone: undefined,
      academicInfo: undefined,
      semesterId: 'sem_active',
      semesterSelectedAt: now,
    }),
  })
}

describe('CreateOpportunityCommandHandler', () => {
  it('coordinator creates draft pre-approved opportunity', async () => {
    const { uow, semesters, opportunities } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester())
    const handler = new CreateOpportunityCommandHandler(uow, buildMockIdGenerator('opp_test'))

    const result = await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
      }),
      payload: validPayload,
    })

    expect(result.id).toBe('opp_test_001')
    expect(opportunities.create).toHaveBeenCalledOnce()
    const [opportunity] = opportunities.create.mock.calls[0]!
    expect(opportunity.status).toBe('draft')
    expect(opportunity.createdByUserId).toBe('usr_coord')
  })

  it('student creates custom pending_verification opportunity using selected semester', async () => {
    const { uow, users, semesters, opportunities } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudentWithSemester())
    semesters.findById.mockResolvedValueOnce(buildSemester())
    const handler = new CreateOpportunityCommandHandler(uow, buildMockIdGenerator('opp_test'))

    await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
      }),
      payload: { ...validPayload, semesterId: 'sem_other', type: 'pre_approved' },
    })

    const [opportunity] = opportunities.create.mock.calls[0]!
    expect(opportunity.semesterId).toBe('sem_active')
    expect(opportunity.type).toBe('custom')
    expect(opportunity.status).toBe('pending_verification')
    expect(opportunity.submittedByUserId).toBe('usr_student')
  })

  it('student without selected semester gets student_has_no_selected_semester', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(null)
    const handler = new CreateOpportunityCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        payload: validPayload,
      })
    ).rejects.toMatchObject({ reason: 'student_has_no_selected_semester' })
  })

  it('referenced non-active semester gets semester_not_active', async () => {
    const { uow, semesters } = buildMockUow()
    semesters.findById.mockResolvedValueOnce(buildSemester('draft'))
    const handler = new CreateOpportunityCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
        }),
        payload: validPayload,
      })
    ).rejects.toMatchObject({ reason: 'semester_not_active' })
  })
})
