import { describe, expect, it } from 'vitest'
import { Notification } from '../../../../src/domain/entities/notification'

describe('Notification.forOpportunityVerification', () => {
  it('creates an opportunity_verified notification for approved submissions', () => {
    const now = new Date('2026-04-01T00:00:00Z')

    const notification = Notification.forOpportunityVerification({
      id: 'nt_test',
      userId: 'usr_student',
      opportunityId: 'opp_test',
      approved: true,
      now,
    })

    expect(notification.id).toBe('nt_test')
    expect(notification.version).toBe(0)
    expect(notification.userId).toBe('usr_student')
    expect(notification.type).toBe('opportunity_verified')
    expect(notification.relatedOpportunityId).toBe('opp_test')
    expect(notification.readAt).toBeUndefined()
  })

  it('creates an opportunity_rejected notification for rejected submissions', () => {
    const now = new Date('2026-04-01T00:00:00Z')

    const notification = Notification.forOpportunityVerification({
      id: 'nt_test',
      userId: 'usr_student',
      opportunityId: 'opp_test',
      approved: false,
      now,
    })

    expect(notification.type).toBe('opportunity_rejected')
    expect(notification.title).toBe('Opportunity rejected')
  })
})

describe('Notification.markRead', () => {
  it('sets readAt once', () => {
    const first = new Date('2026-04-01T00:00:00Z')
    const second = new Date('2026-04-02T00:00:00Z')
    const notification = Notification.forOpportunityVerification({
      id: 'nt_test',
      userId: 'usr_student',
      opportunityId: 'opp_test',
      approved: true,
      now: first,
    })

    notification.markRead(first)
    notification.markRead(second)

    expect(notification.readAt?.toISOString()).toBe(first.toISOString())
  })
})

describe('Notification.forOfferDecision', () => {
  it('creates an offer_decision notification linked to the internship and opportunity', () => {
    const now = new Date('2026-04-01T00:00:00Z')

    const notification = Notification.forOfferDecision({
      id: 'nt_offer',
      userId: 'usr_student',
      internshipId: 'int_test',
      opportunityId: 'opp_test',
      decision: 'changes_requested',
      now,
    })

    expect(notification.type).toBe('offer_decision')
    expect(notification.title).toBe('Internship offer changes requested')
    expect(notification.relatedInternshipId).toBe('int_test')
    expect(notification.relatedOpportunityId).toBe('opp_test')
  })
})
