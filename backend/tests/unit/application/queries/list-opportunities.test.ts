import { describe, expect, it } from 'vitest'
import { ListOpportunitiesQueryHandler } from '../../../../src/application/queries/list-opportunities'
import { User } from '../../../../src/domain/entities/user'
import { UserIdentity } from '../../../../src/domain/value-objects/user-identity'
import { StudentProfile } from '../../../../src/domain/value-objects/student-profile'
import { buildMockUow, buildPlatformUser, buildRequestActor } from '../../../setup.unit'

function buildStudent() {
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
      semesterId: 'sem_selected',
      semesterSelectedAt: now,
    }),
  })
}

const baseFilter = {
  semesterId: undefined,
  status: undefined,
  type: undefined,
  limit: 50,
  sortField: 'createdAt' as const,
  sortDirection: 'desc' as const,
  cursor: undefined,
}

describe('ListOpportunitiesQueryHandler', () => {
  it('students are forced to published opportunities in their selected semester', async () => {
    const { uow, users, opportunities } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    opportunities.list.mockResolvedValueOnce({ items: [], nextCursor: null })
    const handler = new ListOpportunitiesQueryHandler(uow)

    await handler.handle({
      actor: buildRequestActor({
        platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
      }),
      filter: { ...baseFilter, status: ['draft'] },
    })

    expect(opportunities.list).toHaveBeenCalledWith(
      expect.objectContaining({ semesterId: 'sem_selected', status: ['published'] })
    )
  })

  it('student querying another semester gets invalid_query', async () => {
    const { uow, users } = buildMockUow()
    users.findById.mockResolvedValueOnce(buildStudent())
    const handler = new ListOpportunitiesQueryHandler(uow)

    await expect(
      handler.handle({
        actor: buildRequestActor({
          platformUser: buildPlatformUser({ id: 'usr_student', role: 'student' }),
        }),
        filter: { ...baseFilter, semesterId: 'sem_other' },
      })
    ).rejects.toMatchObject({ name: 'InvalidQueryError', reason: 'invalid_query' })
  })
})
