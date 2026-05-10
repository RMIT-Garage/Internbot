import { describe, expect, it } from 'vitest'
import { Opportunity } from '../../../../src/domain/entities/opportunity'
import { OpportunityTransition } from '../../../../src/domain/value-objects/opportunity-transition'
import { OpportunityVerification } from '../../../../src/domain/value-objects/opportunity-verification'

function buildOpportunity(overrides: Partial<Parameters<typeof Opportunity.rehydrate>[0]> = {}) {
  const now = new Date('2026-04-01T00:00:00Z')
  return Opportunity.rehydrate({
    id: 'opp_test',
    version: 1,
    semesterId: 'sem_test',
    type: 'pre_approved',
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build software',
    workMode: 'hybrid',
    location: 'Melbourne',
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    status: 'draft',
    createdByUserId: 'usr_coord',
    submittedByUserId: undefined,
    verifiedByUserId: undefined,
    verifiedAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

describe('Opportunity.create', () => {
  const baseProps = {
    id: 'opp_test',
    version: 0,
    semesterId: 'sem_test',
    type: 'pre_approved' as const,
    employerName: 'Example Pty Ltd',
    jobTitle: 'Software Intern',
    descriptionText: 'Build software',
    workMode: undefined,
    location: undefined,
    sourceUrl: 'https://careerhub.rmit.edu.au/jobs/123',
    status: 'draft' as const,
    createdByUserId: 'usr_coord',
    submittedByUserId: undefined,
    verifiedByUserId: undefined,
    verifiedAt: undefined,
    createdAt: new Date('2026-04-01T00:00:00Z'),
    updatedAt: new Date('2026-04-01T00:00:00Z'),
  }

  it('accepts a pre-approved opportunity with an allowlisted Career Hub URL', () => {
    const opportunity = Opportunity.create(baseProps)
    expect(opportunity.type).toBe('pre_approved')
    expect(opportunity.status).toBe('draft')
  })

  it('rejects a pre-approved opportunity with a non-allowlist URL', () => {
    expect(() =>
      Opportunity.create({ ...baseProps, sourceUrl: 'https://example.com/jobs/123' })
    ).toThrowError(/Career Hub/)
  })

  it('allows custom opportunities with arbitrary source URLs', () => {
    const opportunity = Opportunity.create({
      ...baseProps,
      type: 'custom',
      sourceUrl: 'https://seek.com.au/job/123',
      status: 'pending_verification',
      createdByUserId: undefined,
      submittedByUserId: 'usr_student',
    })
    expect(opportunity.type).toBe('custom')
    expect(opportunity.sourceUrl).toBe('https://seek.com.au/job/123')
  })
})

describe('Opportunity.applyTransition', () => {
  const now = new Date('2026-04-01T00:00:00Z')

  it('draft → published mutates status and emits an OpportunityTransitioned event', () => {
    const opportunity = buildOpportunity({ status: 'draft' })
    opportunity.applyTransition('published', 'usr_coord', 'go live', now)

    expect(opportunity.status).toBe('published')
    expect(opportunity.pendingEvents).toHaveLength(1)
    const event = opportunity.pendingEvents[0]!
    expect(event.kind).toBe('opportunity_transitioned')
    if (event.kind !== 'opportunity_transitioned') throw new Error('expected transitioned')
    expect(event.transition).toBeInstanceOf(OpportunityTransition)
    expect(event.transition.from).toBe('draft')
    expect(event.transition.to).toBe('published')
    expect(event.transition.actorUserId).toBe('usr_coord')
  })

  it('published → archived is allowed', () => {
    const opportunity = buildOpportunity({ status: 'published' })
    opportunity.applyTransition('archived', 'usr_coord', undefined, now)
    expect(opportunity.status).toBe('archived')
  })

  it('pending_verification → published is rejected on the transition endpoint path', () => {
    const opportunity = buildOpportunity({ status: 'pending_verification', type: 'custom' })
    expect(() =>
      opportunity.applyTransition('published', 'usr_coord', undefined, now)
    ).toThrowError(/Cannot transition/)
  })
})

describe('Opportunity.verify', () => {
  const now = new Date('2026-04-01T00:00:00Z')

  it('approved moves pending_verification → published and stages verification', () => {
    const opportunity = buildOpportunity({
      type: 'custom',
      status: 'pending_verification',
      submittedByUserId: 'usr_student',
      createdByUserId: undefined,
      sourceUrl: undefined,
    })

    opportunity.verify('approved', 'usr_coord', undefined, now)

    expect(opportunity.status).toBe('published')
    expect(opportunity.verifiedByUserId).toBe('usr_coord')
    expect(opportunity.verifiedAt?.toISOString()).toBe(now.toISOString())
    expect(opportunity.pendingEvents).toHaveLength(1)
    const event = opportunity.pendingEvents[0]!
    expect(event.kind).toBe('opportunity_verified')
    if (event.kind !== 'opportunity_verified') throw new Error('expected verified')
    expect(event.verification).toBeInstanceOf(OpportunityVerification)
    expect(event.verification.decision).toBe('approved')
  })

  it('rejected without comment throws comment_required_for_decision', () => {
    const opportunity = buildOpportunity({
      type: 'custom',
      status: 'pending_verification',
      submittedByUserId: 'usr_student',
      createdByUserId: undefined,
      sourceUrl: undefined,
    })

    expect(() => opportunity.verify('rejected', 'usr_coord', undefined, now)).toThrowError(
      /comment/
    )
    try {
      opportunity.verify('rejected', 'usr_coord', undefined, now)
    } catch (err: unknown) {
      expect((err as { reason?: string }).reason).toBe('comment_required_for_decision')
    }
  })

  it('non-pending opportunities cannot be verified', () => {
    const opportunity = buildOpportunity({ status: 'draft' })
    expect(() => opportunity.verify('approved', 'usr_coord', undefined, now)).toThrowError(
      /pending verification/
    )
  })
})
