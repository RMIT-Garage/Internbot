import { describe, expect, it } from 'vitest'
import { VerifyOpportunityCommandHandler } from '../../../../src/application/commands/verify-opportunity'
import { Opportunity } from '../../../../src/domain/entities/opportunity'
import {
  buildMockIdGenerator,
  buildMockUow,
  buildPlatformUser,
  buildRequestActor,
} from '../../../setup.unit'

function buildOpportunity(status: 'draft' | 'pending_verification' = 'pending_verification') {
  const now = new Date('2026-04-01T00:00:00Z')
  return Opportunity.rehydrate({
    id: 'opp_test',
    version: 2,
    semesterId: 'sem_test',
    type: 'custom',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build software',
    workMode: undefined,
    location: undefined,
    sourceUrl: undefined,
    status,
    createdByUserId: undefined,
    submittedByUserId: 'usr_student',
    verifiedByUserId: undefined,
    verifiedAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
}

describe('VerifyOpportunityCommandHandler', () => {
  const coord = buildRequestActor({
    platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
  })

  it('approved moves to published and saves', async () => {
    const { uow, opportunities, notifications } = buildMockUow()
    const opportunity = buildOpportunity()
    opportunities.findById.mockResolvedValueOnce(opportunity)
    const handler = new VerifyOpportunityCommandHandler(uow, buildMockIdGenerator('nt_test'))

    await handler.handle({
      actor: coord,
      opportunityId: 'opp_test',
      decision: 'approved',
      comment: undefined,
    })

    expect(opportunity.status).toBe('published')
    expect(opportunity.verifiedByUserId).toBe('usr_coord')
    expect(opportunity.pendingVerification?.decision).toBe('approved')
    expect(opportunities.save).toHaveBeenCalledWith(opportunity)
    expect(notifications.create).toHaveBeenCalledOnce()
    const [notification] = notifications.create.mock.calls[0]!
    expect(notification.id).toBe('nt_test_001')
    expect(notification.userId).toBe('usr_student')
    expect(notification.type).toBe('opportunity_verified')
  })

  it('rejected without comment gets comment_required_for_decision', async () => {
    const { uow, opportunities } = buildMockUow()
    opportunities.findById.mockResolvedValueOnce(buildOpportunity())
    const handler = new VerifyOpportunityCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: coord,
        opportunityId: 'opp_test',
        decision: 'rejected',
        comment: undefined,
      })
    ).rejects.toMatchObject({ reason: 'comment_required_for_decision' })
  })

  it('non-pending opportunity gets invalid_state_transition', async () => {
    const { uow, opportunities } = buildMockUow()
    opportunities.findById.mockResolvedValueOnce(buildOpportunity('draft'))
    const handler = new VerifyOpportunityCommandHandler(uow, buildMockIdGenerator())

    await expect(
      handler.handle({
        actor: coord,
        opportunityId: 'opp_test',
        decision: 'approved',
        comment: undefined,
      })
    ).rejects.toMatchObject({ reason: 'invalid_state_transition' })
  })
})
