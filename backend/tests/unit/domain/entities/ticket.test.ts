import { describe, expect, it } from 'vitest'
import { Ticket } from '../../../../src/domain/entities/ticket'
import type { TicketStatus } from '../../../../src/domain/value-objects/ticket-enums'

const NOW = new Date('2026-04-01T00:00:00Z')
const LATER = new Date('2026-04-02T00:00:00Z')

function ticket(status: TicketStatus = 'open', userId = 'usr_student'): Ticket {
  return Ticket.rehydrate({
    id: 'tkt_001',
    version: 1,
    userId,
    subject: 'Subject',
    body: 'Body',
    category: 'eligibility',
    status,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

describe('Ticket.open', () => {
  it('starts in `open` with version 0 and trims subject/body/category', () => {
    const t = Ticket.open({
      id: 'tkt_001',
      userId: 'usr_student',
      subject: '  Need help  ',
      body: '  Body text  ',
      category: '  eligibility ',
      now: NOW,
    })

    expect(t.id).toBe('tkt_001')
    expect(t.version).toBe(0)
    expect(t.status).toBe('open')
    expect(t.userId).toBe('usr_student')
    expect(t.subject).toBe('Need help')
    expect(t.body).toBe('Body text')
    expect(t.category).toBe('eligibility')
    expect(t.createdAt).toBe(NOW)
    expect(t.updatedAt).toBe(NOW)
  })

  it('treats whitespace-only category as undefined', () => {
    const t = Ticket.open({
      id: 'tkt_001',
      userId: 'usr_student',
      subject: 'Need help',
      body: 'Body',
      category: '   ',
      now: NOW,
    })

    expect(t.category).toBeUndefined()
  })

  it('rejects empty subject', () => {
    expect(() =>
      Ticket.open({
        id: 'tkt_001',
        userId: 'usr_student',
        subject: '   ',
        body: 'Body',
        category: undefined,
        now: NOW,
      })
    ).toThrow(expect.objectContaining({ reason: 'missing_required_field' }))
  })

  it('rejects empty body', () => {
    expect(() =>
      Ticket.open({
        id: 'tkt_001',
        userId: 'usr_student',
        subject: 'Subject',
        body: '   ',
        category: undefined,
        now: NOW,
      })
    ).toThrow(expect.objectContaining({ reason: 'missing_required_field' }))
  })
})

describe('Ticket.transition', () => {
  it('coordinator can move open → in_progress and stages a transition activity with actorRole', () => {
    const t = ticket('open')

    t.transition(
      { to: 'in_progress', comment: 'looking now' },
      { userId: 'usr_coord', role: 'coordinator', isOwner: false },
      'act_001',
      LATER
    )

    expect(t.status).toBe('in_progress')
    expect(t.updatedAt).toBe(LATER)
    expect(t.pendingEvents).toHaveLength(1)
    const event = t.pendingEvents[0]!
    expect(event.kind).toBe('ticket_transitioned')
    if (event.kind !== 'ticket_transitioned') throw new Error('expected transitioned')
    const activity = event.activity
    expect(activity.type).toBe('transition')
    expect(activity.from).toBe('open')
    expect(activity.to).toBe('in_progress')
    expect(activity.actorUserId).toBe('usr_coord')
    expect(activity.actorRole).toBe('coordinator')
    expect(activity.comment).toBe('looking now')
  })

  it('student owner can close their own open ticket', () => {
    const t = ticket('open')

    t.transition(
      { to: 'closed', comment: undefined },
      { userId: 'usr_student', role: 'student', isOwner: true },
      'act_001',
      LATER
    )

    expect(t.status).toBe('closed')
  })

  it('rejects student-owner attempt to move open → in_progress as role_restricted_action', () => {
    expect(() =>
      ticket('open').transition(
        { to: 'in_progress', comment: undefined },
        { userId: 'usr_student', role: 'student', isOwner: true },
        'act_001',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'role_restricted_action' }))
  })

  it('owner can reopen a resolved ticket', () => {
    const t = ticket('resolved')

    t.transition(
      { to: 'open', comment: undefined },
      { userId: 'usr_student', role: 'student', isOwner: true },
      'act_001',
      LATER
    )

    expect(t.status).toBe('open')
  })

  it('coordinator cannot reopen a closed ticket', () => {
    expect(() =>
      ticket('closed').transition(
        { to: 'open', comment: undefined },
        { userId: 'usr_coord', role: 'coordinator', isOwner: false },
        'act_001',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'role_restricted_action' }))
  })

  it('rejects invalid state pair as invalid_state_transition', () => {
    expect(() =>
      ticket('open').transition(
        { to: 'resolved', comment: undefined },
        { userId: 'usr_coord', role: 'coordinator', isOwner: false },
        'act_001',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'invalid_state_transition' }))
  })

  it('rejects student non-owner with student_not_owner', () => {
    expect(() =>
      ticket('open').transition(
        { to: 'closed', comment: undefined },
        { userId: 'usr_other', role: 'student', isOwner: false },
        'act_001',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'student_not_owner' }))
  })
})

describe('Ticket.reply', () => {
  it('builds a reply VO with author + role + trimmed text', () => {
    const reply = ticket('open').addReply(
      'rep_001',
      { userId: 'usr_coord', role: 'coordinator', isOwner: false },
      '  Will follow up  ',
      LATER
    )

    expect(reply.id).toBe('rep_001')
    expect(reply.authorUserId).toBe('usr_coord')
    expect(reply.authorRole).toBe('coordinator')
    expect(reply.text).toBe('Will follow up')
    expect(reply.createdAt).toBe(LATER)
  })

  it('rejects empty text', () => {
    expect(() =>
      ticket('open').addReply(
        'rep_001',
        { userId: 'usr_coord', role: 'coordinator', isOwner: false },
        '   ',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'missing_required_field' }))
  })

  it('rejects student non-owner with student_not_owner', () => {
    expect(() =>
      ticket('open', 'usr_other').addReply(
        'rep_001',
        { userId: 'usr_student', role: 'student', isOwner: false },
        'hi',
        LATER
      )
    ).toThrow(expect.objectContaining({ reason: 'student_not_owner' }))
  })
})
