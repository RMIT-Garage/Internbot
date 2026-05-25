import { describe, it, expect } from 'vitest'
import { Semester } from '../../../../src/domain/entities/semester'
import { SemesterTransition } from '../../../../src/domain/value-objects/semester-transition'

function buildSemester(overrides: Partial<Parameters<typeof Semester.rehydrate>[0]> = {}) {
  const now = new Date('2026-01-15T00:00:00Z')
  return Semester.rehydrate({
    id: 'sem_test',
    version: 1,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Semester 1 2026',
    status: 'draft',
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  })
}

describe('Semester.create', () => {
  const baseProps = {
    id: '',
    version: 0,
    semesterCode: '2026-S1',
    courseCode: 'INTE2710',
    displayName: 'Semester 1 2026',
    status: 'draft' as const,
    enrolmentOpenAt: undefined,
    enrolmentCloseAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('rejects empty semesterCode', () => {
    expect(() => Semester.create({ ...baseProps, semesterCode: '' })).toThrowError(/semesterCode/)
  })

  it('rejects empty courseCode', () => {
    expect(() => Semester.create({ ...baseProps, courseCode: '' })).toThrowError(/courseCode/)
  })

  it('rejects empty displayName', () => {
    expect(() => Semester.create({ ...baseProps, displayName: '' })).toThrowError(/displayName/)
  })

  it('returns a Semester instance with the props', () => {
    const s = Semester.create(baseProps)
    expect(s.semesterCode).toBe('2026-S1')
    expect(s.courseCode).toBe('INTE2710')
    expect(s.status).toBe('draft')
  })
})

describe('Semester.changeDisplayName', () => {
  it('mutates the displayName', () => {
    const s = buildSemester()
    s.changeDisplayName('Renamed')
    expect(s.displayName).toBe('Renamed')
  })

  it('is a no-op on same value (does not bump anything)', () => {
    const s = buildSemester({ displayName: 'X' })
    s.changeDisplayName('X')
    expect(s.displayName).toBe('X')
  })

  it('rejects empty string', () => {
    const s = buildSemester()
    expect(() => s.changeDisplayName('')).toThrowError(/displayName/)
  })
})

describe('Semester.changeEnrolmentOpenAt / changeEnrolmentCloseAt', () => {
  it('sets and clears enrolmentOpenAt', () => {
    const s = buildSemester()
    const open = new Date('2026-01-15T00:00:00Z')
    s.changeEnrolmentOpenAt(open)
    expect(s.enrolmentOpenAt?.toISOString()).toBe(open.toISOString())
    s.changeEnrolmentOpenAt(undefined)
    expect(s.enrolmentOpenAt).toBeUndefined()
  })

  it('sets and clears enrolmentCloseAt', () => {
    const s = buildSemester()
    const close = new Date('2026-03-13T23:59:59Z')
    s.changeEnrolmentCloseAt(close)
    expect(s.enrolmentCloseAt?.toISOString()).toBe(close.toISOString())
    s.changeEnrolmentCloseAt(undefined)
    expect(s.enrolmentCloseAt).toBeUndefined()
  })
})

describe('Semester.isEnrolmentOpen', () => {
  it('always-open when no window is set', () => {
    const s = buildSemester()
    expect(s.isEnrolmentOpen(new Date())).toBe(true)
  })

  it('respects open lower bound', () => {
    const open = new Date('2026-01-15T00:00:00Z')
    const s = buildSemester({ enrolmentOpenAt: open })
    expect(s.isEnrolmentOpen(new Date('2026-01-14T23:59:59Z'))).toBe(false)
    expect(s.isEnrolmentOpen(open)).toBe(true)
  })

  it('respects close upper bound (exclusive)', () => {
    const close = new Date('2026-03-13T23:59:59Z')
    const s = buildSemester({ enrolmentCloseAt: close })
    expect(s.isEnrolmentOpen(new Date('2026-03-13T23:59:58Z'))).toBe(true)
    expect(s.isEnrolmentOpen(close)).toBe(false)
  })
})

describe('Semester.applyTransition', () => {
  const now = new Date('2026-01-15T00:00:00Z')

  it('draft → enrollment_open mutates status and emits a SemesterTransitioned event', () => {
    const s = buildSemester({ status: 'draft' })
    s.applyTransition('enrollment_open', 'usr_coord', undefined, now)
    expect(s.status).toBe('enrollment_open')
    expect(s.pendingEvents).toHaveLength(1)
    const event = s.pendingEvents[0]!
    expect(event.kind).toBe('semester_transitioned')
    const t = event.kind === 'semester_transitioned' ? event.transition : undefined
    expect(t).toBeInstanceOf(SemesterTransition)
    expect(t?.from).toBe('draft')
    expect(t?.to).toBe('enrollment_open')
    expect(t?.actorUserId).toBe('usr_coord')
    expect(t?.createdAt.toISOString()).toBe(now.toISOString())
    expect(event.occurredAt.toISOString()).toBe(now.toISOString())
  })

  it('rehydrated aggregates have no pendingEvents until applyTransition runs', () => {
    const s = buildSemester({ status: 'draft' })
    expect(s.pendingEvents).toHaveLength(0)
  })

  it('draft → archived is allowed', () => {
    const s = buildSemester({ status: 'draft' })
    s.applyTransition('archived', 'usr_coord', 'cancelled', now)
    expect(s.status).toBe('archived')
    const event = s.pendingEvents[0]!
    expect(event.kind === 'semester_transitioned' && event.transition.comment).toBe('cancelled')
  })

  it('enrollment_open → placement_running is allowed', () => {
    const s = buildSemester({ status: 'enrollment_open' })
    s.applyTransition('placement_running', 'usr_coord', undefined, now)
    expect(s.status).toBe('placement_running')
  })

  it('enrollment_open → archived is allowed', () => {
    const s = buildSemester({ status: 'enrollment_open' })
    s.applyTransition('archived', 'usr_coord', undefined, now)
    expect(s.status).toBe('archived')
  })

  it('placement_running → reporting is allowed', () => {
    const s = buildSemester({ status: 'placement_running' })
    s.applyTransition('reporting', 'usr_coord', undefined, now)
    expect(s.status).toBe('reporting')
  })

  it('placement_running → archived is allowed', () => {
    const s = buildSemester({ status: 'placement_running' })
    s.applyTransition('archived', 'usr_coord', undefined, now)
    expect(s.status).toBe('archived')
  })

  it('reporting → archived is allowed', () => {
    const s = buildSemester({ status: 'reporting' })
    s.applyTransition('archived', 'usr_coord', undefined, now)
    expect(s.status).toBe('archived')
  })

  it('archived → enrollment_open is allowed (free-form transitions)', () => {
    const s = buildSemester({ status: 'archived' })
    s.applyTransition('enrollment_open', 'usr_coord', undefined, now)
    expect(s.status).toBe('enrollment_open')
  })

  it('draft → placement_running is allowed (free-form transitions)', () => {
    const s = buildSemester({ status: 'draft' })
    s.applyTransition('placement_running', 'usr_coord', undefined, now)
    expect(s.status).toBe('placement_running')
  })

  it('enrollment_open → reporting is allowed (free-form transitions)', () => {
    const s = buildSemester({ status: 'enrollment_open' })
    s.applyTransition('reporting', 'usr_coord', undefined, now)
    expect(s.status).toBe('reporting')
  })

  it('archived → archived is allowed (no-op status)', () => {
    const s = buildSemester({ status: 'archived' })
    s.applyTransition('archived', 'usr_coord', undefined, now)
    expect(s.status).toBe('archived')
  })
})
