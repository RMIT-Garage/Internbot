import { describe, it, expect } from 'vitest'
import { SemesterTransition } from '../../../../src/domain/value-objects/semester-transition'

describe('SemesterTransition.create', () => {
  const baseProps = {
    from: 'draft' as const,
    to: 'active' as const,
    actorUserId: 'usr_coord',
    comment: undefined,
    createdAt: new Date('2026-01-15T00:00:00Z'),
  }

  it('builds a valid transition record', () => {
    const t = SemesterTransition.create(baseProps)
    expect(t.from).toBe('draft')
    expect(t.to).toBe('active')
    expect(t.actorUserId).toBe('usr_coord')
    expect(t.comment).toBeUndefined()
  })

  it('accepts an optional comment', () => {
    const t = SemesterTransition.create({ ...baseProps, comment: 'cancelled offering' })
    expect(t.comment).toBe('cancelled offering')
  })

  it('rejects empty actorUserId', () => {
    expect(() => SemesterTransition.create({ ...baseProps, actorUserId: '' })).toThrow()
  })
})
