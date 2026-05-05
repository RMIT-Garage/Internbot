import { describe, expect, it } from 'vitest'
import { Internship } from '../../../../src/domain/entities/internship'
import type { InternshipStatus } from '../../../../src/domain/value-objects/internship-enums'

const NOW = new Date('2026-04-01T00:00:00Z')
const LATER = new Date('2026-04-02T00:00:00Z')

function internship(status: InternshipStatus = 'applied'): Internship {
  return Internship.rehydrate({
    id: 'int_001',
    version: 1,
    userId: 'usr_student',
    opportunityId: 'opp_001',
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

describe('Internship', () => {
  it('createApplication starts applied and stages apply activity', () => {
    const created = Internship.createApplication({
      id: 'int_001',
      userId: 'usr_student',
      opportunityId: 'opp_001',
      activityId: 'act_apply',
      now: NOW,
    })

    expect(created.status).toBe('applied')
    expect(created.version).toBe(0)
    expect(created.pendingActivity?.type).toBe('apply')
    expect(created.pendingActivity?.authorUserId).toBe('usr_student')
  })

  it('submitOffer requires an offer attachment', () => {
    expect(() =>
      internship().submitOffer(
        {
          offerDate: LATER,
          startDate: new Date('2026-05-01T00:00:00Z'),
          endDate: undefined,
        },
        'act_submit',
        LATER,
        false
      )
    ).toThrow(expect.objectContaining({ reason: 'offer_attachment_missing' }))
  })

  it('submitOffer moves applied → offer_pending_review and stages submit_offer activity', () => {
    const entity = internship()

    entity.submitOffer(
      {
        offerDate: LATER,
        startDate: new Date('2026-05-01T00:00:00Z'),
        endDate: new Date('2026-07-01T00:00:00Z'),
      },
      'act_submit',
      LATER,
      true
    )

    expect(entity.status).toBe('offer_pending_review')
    expect(entity.lastSubmittedAt).toBe(LATER)
    expect(entity.pendingActivity?.type).toBe('submit_offer')
  })

  it('submitOffer rejects non-submittable states', () => {
    expect(() =>
      internship('offer_pending_review').submitOffer(
        {
          offerDate: LATER,
          startDate: new Date('2026-05-01T00:00:00Z'),
          endDate: undefined,
        },
        'act_submit',
        LATER,
        true
      )
    ).toThrow(expect.objectContaining({ reason: 'invalid_state_transition' }))
  })

  it('updateOfferDetails rejects terminal states', () => {
    expect(() =>
      internship('offer_approved').updateOfferDetails(
        {
          offerDate: LATER,
          startDate: new Date('2026-05-01T00:00:00Z'),
          endDate: undefined,
        },
        'act_edit',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'internship_not_editable' }))
  })

  it('comment requires non-empty text', () => {
    expect(() => internship().comment('act_comment', 'usr_student', 'student', ' ', NOW)).toThrow(
      expect.objectContaining({ reason: 'missing_required_field' })
    )
  })
})
