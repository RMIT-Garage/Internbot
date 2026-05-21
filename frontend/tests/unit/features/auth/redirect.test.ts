import { describe, it, expect } from 'vitest'
import { getRedirectPath, getDefaultRedirectPath } from '@/features/auth/utils/redirect'

describe('getDefaultRedirectPath', () => {
  it('routes students to /student/dashboard', () => {
    expect(getDefaultRedirectPath('student')).toBe('/student/dashboard')
  })

  it('routes coordinators to /coordinator/dashboard', () => {
    expect(getDefaultRedirectPath('coordinator')).toBe('/coordinator/dashboard')
  })

  it('treats unknown / missing role as student', () => {
    expect(getDefaultRedirectPath(undefined)).toBe('/student/dashboard')
    expect(getDefaultRedirectPath('')).toBe('/student/dashboard')
  })
})

describe('getRedirectPath', () => {
  it('returns the student dashboard when no query string is provided', () => {
    expect(getRedirectPath('')).toBe('/student/dashboard')
  })

  it('returns the student dashboard when ?redirect= is missing', () => {
    expect(getRedirectPath('?foo=bar')).toBe('/student/dashboard')
  })

  it('returns the coordinator dashboard for coordinator role with no query', () => {
    expect(getRedirectPath('', 'coordinator')).toBe('/coordinator/dashboard')
  })

  it('returns the redirect target for safe same-origin paths', () => {
    expect(getRedirectPath('?redirect=%2Fapplications%2F123')).toBe('/applications/123')
  })

  it('rejects protocol-relative URLs (open redirect)', () => {
    expect(getRedirectPath('?redirect=%2F%2Fevil.com%2Fpwn')).toBe('/student/dashboard')
  })

  it('rejects backslash-prefixed URLs', () => {
    expect(getRedirectPath('?redirect=%2F%5Cevil.com')).toBe('/student/dashboard')
  })

  it('rejects absolute URLs to other origins', () => {
    expect(getRedirectPath('?redirect=https%3A%2F%2Fevil.com')).toBe('/student/dashboard')
  })

  it('rejects relative paths that do not start with /', () => {
    expect(getRedirectPath('?redirect=dashboard')).toBe('/student/dashboard')
  })

  it('rejects /coordinator/* targets for non-coordinator roles', () => {
    expect(getRedirectPath('?redirect=%2Fcoordinator%2Fjobs', 'student')).toBe('/student/dashboard')
  })
})
