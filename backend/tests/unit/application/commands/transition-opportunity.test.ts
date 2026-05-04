import { describe, expect, it } from 'vitest'
import { TransitionOpportunityCommandHandler } from '../../../../src/application/commands/transition-opportunity'
import { Opportunity } from '../../../../src/domain/entities/opportunity'
import { buildMockUow, buildPlatformUser, buildRequestActor } from '../../../setup.unit'

function buildOpportunity(status: 'draft' | 'pending_verification' | 'published' = 'draft') {
  const now = new Date('2026-04-01T00:00:00Z')
  return Opportunity.rehydrate({
    id: 'opp_test',
    version: 3,
    semesterId: 'sem_test',
    type: status === 'pending_verification' ? 'custom' : 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build software',
    workMode: undefined,
    location: undefined,
    sourceUrl:
      status === 'pending_verification' ? undefined : 'https://careerhub.rmit.edu.au/jobs/1',
    status,
    createdByUserId: status === 'pending_verification' ? undefined : 'usr_coord',
    submittedByUserId: status === 'pending_verification' ? 'usr_student' : undefined,
    verifiedByUserId: undefined,
    verifiedAt: undefined,
    createdAt: now,
    updatedAt: now,
  })
}

describe('TransitionOpportunityCommandHandler', () => {
  const coord = buildRequestActor({
    platformUser: buildPlatformUser({ id: 'usr_coord', role: 'coordinator' }),
  })

  it('rejects student callers', async () => {
    const { uow } = buildMockUow()
    const handler = new TransitionOpportunityCommandHandler(uow)
    await expect(
      handler.handle({
        actor: buildRequestActor({ platformUser: buildPlatformUser({ role: 'student' }) }),
        opportunityId: 'opp_test',
        to: 'published',
        comment: undefined,
      })
    ).rejects.toMatchObject({ reason: 'role_restricted_action' })
  })

  it('draft → published stages transition and saves', async () => {
    const { uow, opportunities } = buildMockUow()
    const opportunity = buildOpportunity('draft')
    opportunities.findById.mockResolvedValueOnce(opportunity)
    const handler = new TransitionOpportunityCommandHandler(uow)

    await handler.handle({
      actor: coord,
      opportunityId: 'opp_test',
      to: 'published',
      comment: 'go',
    })

    expect(opportunity.status).toBe('published')
    expect(opportunity.pendingTransition?.from).toBe('draft')
    expect(opportunity.pendingTransition?.to).toBe('published')
    expect(opportunities.save).toHaveBeenCalledWith(opportunity)
  })

  it('pending_verification → published surfaces invalid_state_transition', async () => {
    const { uow, opportunities } = buildMockUow()
    opportunities.findById.mockResolvedValueOnce(buildOpportunity('pending_verification'))
    const handler = new TransitionOpportunityCommandHandler(uow)

    await expect(
      handler.handle({
        actor: coord,
        opportunityId: 'opp_test',
        to: 'published',
        comment: undefined,
      })
    ).rejects.toMatchObject({ reason: 'invalid_state_transition' })
  })
})
