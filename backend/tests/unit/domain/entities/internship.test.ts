import { describe, expect, it } from 'vitest'
import { Internship } from '../../../../src/domain/entities/internship'
import { Attachment } from '../../../../src/domain/value-objects/attachment'
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

  it('submitOffer succeeds with no dates as long as an attachment exists', () => {
    const entity = internship()

    entity.submitOffer(
      { offerDate: undefined, startDate: undefined, endDate: undefined },
      'act_submit',
      LATER,
      true
    )

    expect(entity.status).toBe('offer_pending_review')
    expect(entity.offerDate).toBeUndefined()
    expect(entity.startDate).toBeUndefined()
    expect(latestActivity(entity).type).toBe('submit_offer')
  })

  it('submitOffer preserves previously-set dates when resubmitting without dates', () => {
    const entity = internship('offer_changes_requested')

    entity.updateOfferDetails(
      { offerDate: LATER, startDate: new Date('2026-05-01T00:00:00Z'), endDate: undefined },
      'act_edit',
      LATER
    )

    entity.submitOffer(
      { offerDate: undefined, startDate: undefined, endDate: undefined },
      'act_submit',
      LATER,
      true
    )

    expect(entity.status).toBe('offer_pending_review')
    expect(entity.offerDate).toEqual(LATER)
    expect(entity.startDate).toEqual(new Date('2026-05-01T00:00:00Z'))
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

function attachment(id = 'att_001'): Attachment {
  return Attachment.rehydrate({
    id,
    filePath: `internships/int_001/${id}/offer.pdf`,
    fileName: 'offer.pdf',
    contentType: 'application/pdf',
    uploadedAt: NOW,
    storageGeneration: '1234567890',
    uploadStatus: 'finalized',
  })
}

function internshipWithAttachments(
  status: InternshipStatus = 'applied',
  attachments: Attachment[] = [attachment()]
): Internship {
  return Internship.rehydrate(
    {
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
    },
    attachments
  )
}

describe('Internship.removeAttachment', () => {
  it('removes the attachment from the attachments collection', () => {
    const att = attachment('att_001')
    const entity = internshipWithAttachments('applied', [att])

    entity.removeAttachment('att_001', 'usr_student', LATER)

    expect(entity.attachments).toHaveLength(0)
  })

  it('stages an internship_attachment_removed event with correct fields', () => {
    const att = attachment('att_001')
    const entity = internshipWithAttachments('applied', [att])

    entity.removeAttachment('att_001', 'usr_student', LATER)

    const event = entity.pendingEvents[entity.pendingEvents.length - 1]!
    expect(event.kind).toBe('internship_attachment_removed')
    if (event.kind !== 'internship_attachment_removed') throw new Error('wrong event kind')
    expect(event.attachment.id).toBe('att_001')
    expect(event.attachment.filePath).toBe('internships/int_001/att_001/offer.pdf')
    expect(event.removedByUserId).toBe('usr_student')
    expect(event.occurredAt).toBe(LATER)
  })

  it('only removes the targeted attachment when multiple are present', () => {
    const att1 = attachment('att_001')
    const att2 = attachment('att_002')
    const entity = internshipWithAttachments('applied', [att1, att2])

    entity.removeAttachment('att_001', 'usr_student', LATER)

    expect(entity.attachments).toHaveLength(1)
    expect(entity.attachments[0]!.id).toBe('att_002')
  })

  it('throws NotFoundError when attachment id does not exist', () => {
    const entity = internshipWithAttachments('applied', [attachment('att_001')])

    expect(() => entity.removeAttachment('att_nonexistent', 'usr_student', LATER)).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('throws NotFoundError on empty attachments collection', () => {
    const entity = internshipWithAttachments('applied', [])

    expect(() => entity.removeAttachment('att_001', 'usr_student', LATER)).toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' })
    )
  })

  it('throws ConflictError with attachment_locked_in_status when status is offer_pending_review', () => {
    const entity = internshipWithAttachments('offer_pending_review')

    expect(() => entity.removeAttachment('att_001', 'usr_student', LATER)).toThrow(
      expect.objectContaining({ reason: 'attachment_locked_in_status' })
    )
  })

  it('throws ConflictError with attachment_locked_in_status when status is offer_approved', () => {
    const entity = internshipWithAttachments('offer_approved')

    expect(() => entity.removeAttachment('att_001', 'usr_student', LATER)).toThrow(
      expect.objectContaining({ reason: 'attachment_locked_in_status' })
    )
  })

  it('throws ConflictError with attachment_locked_in_status when status is rejected', () => {
    const entity = internshipWithAttachments('rejected')

    expect(() => entity.removeAttachment('att_001', 'usr_student', LATER)).toThrow(
      expect.objectContaining({ reason: 'attachment_locked_in_status' })
    )
  })

  it('allows removal when status is offer_changes_requested', () => {
    const entity = internshipWithAttachments('offer_changes_requested')

    expect(() => entity.removeAttachment('att_001', 'usr_student', LATER)).not.toThrow()
    expect(entity.attachments).toHaveLength(0)
  })

  it('removal marks hasParentMutation true', () => {
    const entity = internshipWithAttachments('applied')

    entity.removeAttachment('att_001', 'usr_student', LATER)

    expect(entity.hasParentMutation).toBe(true)
  })
})
