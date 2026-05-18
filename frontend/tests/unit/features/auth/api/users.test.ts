import { describe, it, expect, beforeEach, vi } from 'vitest'

const apiFetchMock = vi.fn()

vi.mock('@/lib/api/client', async () => {
  class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
      message: string
    ) {
      super(message)
      this.name = 'ApiError'
    }
  }
  return { apiFetch: apiFetchMock, ApiError }
})

const { fetchCurrentUser } = await import('@/features/auth/api/users')
const { ApiError } = await import('@/lib/api/client')

describe('fetchCurrentUser', () => {
  beforeEach(() => {
    apiFetchMock.mockReset()
  })

  it('returns kind=ok with the parsed user on a 200 response', async () => {
    apiFetchMock.mockResolvedValue({
      id: 'usr_1',
      role: 'student',
      email: 's1@student.rmit.edu.au',
    })
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.user.id).toBe('usr_1')
  })

  it('returns kind=unverified on 403 + no_platform_user (top-level reason)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, { reason: 'no_platform_user' }, 'Forbidden'))
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('unverified')
  })

  it('returns kind=unverified for the real backend shape (reason nested under error)', async () => {
    // Mirrors backend/src/api/middleware/error-handler.ts response body.
    apiFetchMock.mockRejectedValue(
      new ApiError(
        403,
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: 403,
          detail: 'Cannot resolve `me`: caller has no platform user record.',
          error: {
            code: 'Forbidden',
            message: 'Cannot resolve `me`: caller has no platform user record.',
            reason: 'no_platform_user',
          },
        },
        'Cannot resolve `me`: caller has no platform user record.'
      )
    )
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('unverified')
  })

  it('returns kind=unauthenticated on 401', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(401, { reason: 'invalid_token' }, 'Unauthorized'))
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('unauthenticated')
  })

  it('rethrows other ApiError responses (e.g. 500)', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(500, { error: 'oops' }, 'Server error'))
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError)
  })

  it('rethrows non-ApiError failures', async () => {
    apiFetchMock.mockRejectedValue(new Error('network down'))
    await expect(fetchCurrentUser()).rejects.toThrow('network down')
  })

  it('does not treat 403 with a different reason as unverified', async () => {
    apiFetchMock.mockRejectedValue(new ApiError(403, { reason: 'forbidden' }, 'Forbidden'))
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError)
  })
})
