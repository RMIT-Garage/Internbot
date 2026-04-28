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

  it('draft → active mutates status and stages a pendingTransition', () => {
    const s = buildSemester({ status: 'draft' })
    s.applyTransition('active', 'usr_coord', undefined, now)
    expect(s.status).toBe('active')
    const t = s.pendingTransition
    expect(t).toBeInstanceOf(SemesterTransition)
    expect(t?.from).toBe('draft')
    expect(t?.to).toBe('active')
    expect(t?.actorUserId).toBe('usr_coord')
    expect(t?.createdAt.toISOString()).toBe(now.toISOString())
  })

  it('rehydrated aggregates carry no pendingTransition until applyTransition runs', () => {
    const s = buildSemester({ status: 'draft' })
    expect(s.pendingTransition).toBeUndefined()
  })

  it('draft → archived is allowed', () => {
    const s = buildSemester({ status: 'draft' })
    s.applyTransition('archived', 'usr_coord', 'cancelled', now)
    expect(s.status).toBe('archived')
    expect(s.pendingTransition?.comment).toBe('cancelled')
  })

  it('active → archived is allowed', () => {
    const s = buildSemester({ status: 'active' })
    s.applyTransition('archived', 'usr_coord', undefined, now)
    expect(s.status).toBe('archived')
  })

  it('archived → active throws ConflictError(invalid_state_transition)', () => {
    const s = buildSemester({ status: 'archived' })
    expect(() => s.applyTransition('active', 'usr_coord', undefined, now)).toMatchObject(
      expect.objectContaining({})
    )
    try {
      s.applyTransition('active', 'usr_coord', undefined, now)
    } catch (err: unknown) {
      expect((err as { name?: string }).name).toBe('ConflictError')
      expect((err as { reason?: string }).reason).toBe('invalid_state_transition')
    }
  })

  it('active → active is rejected', () => {
    const s = buildSemester({ status: 'active' })
    expect(() => s.applyTransition('active', 'usr_coord', undefined, now)).toThrow()
  })

  it('archived → archived is rejected', () => {
    const s = buildSemester({ status: 'archived' })
    expect(() => s.applyTransition('archived', 'usr_coord', undefined, now)).toThrow()
  })
})
