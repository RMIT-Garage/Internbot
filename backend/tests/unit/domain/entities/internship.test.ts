import { describe, expect, it } from 'vitest'
import { Internship } from '../../../../src/domain/entities/internship'
import type { InternshipActivity } from '../../../../src/domain/value-objects/internship-activity'
import type { InternshipStatus } from '../../../../src/domain/value-objects/internship-enums'

const NOW = new Date('2026-04-01T00:00:00Z')
const LATER = new Date('2026-04-02T00:00:00Z')

function latestActivity(entity: Internship): InternshipActivity {
  const event = entity.pendingEvents[entity.pendingEvents.length - 1]
  if (!event) throw new Error('no pendingEvents')
  if (
    event.kind === 'internship_applied' ||
    event.kind === 'internship_offer_edited' ||
    event.kind === 'internship_offer_submitted' ||
    event.kind === 'internship_decided' ||
    event.kind === 'internship_commented'
  ) {
    return event.activity
  }
  throw new Error(`event ${event.kind} carries no activity`)
}

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
    const activity = latestActivity(created)
    expect(activity.type).toBe('apply')
    expect(activity.authorUserId).toBe('usr_student')
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
    expect(latestActivity(entity).type).toBe('submit_offer')
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

  it('approved decision moves pending review → offer_approved and stages approve_offer activity', () => {
    const entity = internship('offer_pending_review')

    entity.decideOffer(
      { decision: 'approved', comment: undefined },
      'act_decision',
      'usr_coord',
      LATER
    )

    expect(entity.status).toBe('offer_approved')
    expect(entity.coordinatorDecision).toBe('approved')
    expect(entity.reviewedByUserId).toBe('usr_coord')
    expect(entity.reviewedAt).toBe(LATER)
    const activity = latestActivity(entity)
    expect(activity.type).toBe('approve_offer')
    expect(activity.authorRole).toBe('coordinator')
  })

  it('changes_requested decision requires a comment', () => {
    expect(() =>
      internship('offer_pending_review').decideOffer(
        { decision: 'changes_requested', comment: ' ' },
        'act_decision',
        'usr_coord',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'comment_required_for_decision' }))
  })

  it('changes_requested decision moves pending review → offer_changes_requested', () => {
    const entity = internship('offer_pending_review')

    entity.decideOffer(
      { decision: 'changes_requested', comment: 'Add supervision details.' },
      'act_decision',
      'usr_coord',
      LATER
    )

    expect(entity.status).toBe('offer_changes_requested')
    expect(entity.coordinatorDecision).toBe('changes_requested')
    expect(entity.coordinatorComment).toBe('Add supervision details.')
    const activity = latestActivity(entity)
    expect(activity.type).toBe('request_changes')
    expect(activity.text).toBe('Add supervision details.')
  })

  it('rejected decision moves pending review → rejected', () => {
    const entity = internship('offer_pending_review')

    entity.decideOffer(
      { decision: 'rejected', comment: 'Program mismatch.' },
      'act_decision',
      'usr_coord',
      LATER
    )

    expect(entity.status).toBe('rejected')
    expect(entity.coordinatorDecision).toBe('rejected')
    expect(latestActivity(entity).type).toBe('reject')
  })

  it('decision rejects non-reviewable states', () => {
    expect(() =>
      internship('applied').decideOffer(
        { decision: 'approved', comment: undefined },
        'act_decision',
        'usr_coord',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'invalid_state_transition' }))
  })
})
