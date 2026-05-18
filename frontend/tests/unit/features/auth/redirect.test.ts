import { describe, it, expect } from 'vitest'
import { getRedirectPath } from '@/features/auth/utils/redirect'

describe('getRedirectPath', () => {
  it('returns /dashboard when no query string is provided', () => {
    expect(getRedirectPath('')).toBe('/dashboard')
  })

  it('returns /dashboard when ?redirect= is missing', () => {
    expect(getRedirectPath('?foo=bar')).toBe('/dashboard')
  })

  it('returns the redirect target for safe same-origin paths', () => {
    expect(getRedirectPath('?redirect=%2Fapplications%2F123')).toBe('/applications/123')
  })

  it('rejects protocol-relative URLs (open redirect)', () => {
    expect(getRedirectPath('?redirect=%2F%2Fevil.com%2Fpwn')).toBe('/dashboard')
  })

  it('rejects backslash-prefixed URLs', () => {
    expect(getRedirectPath('?redirect=%2F%5Cevil.com')).toBe('/dashboard')
  })

  it('rejects absolute URLs to other origins', () => {
    expect(getRedirectPath('?redirect=https%3A%2F%2Fevil.com')).toBe('/dashboard')
  })

  it('rejects relative paths that do not start with /', () => {
    expect(getRedirectPath('?redirect=dashboard')).toBe('/dashboard')
  })
})
