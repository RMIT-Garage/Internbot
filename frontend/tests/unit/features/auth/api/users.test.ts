import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ApiError } from '@/api/core/ApiError'
import type { ApiRequestOptions } from '@/api/core/ApiRequestOptions'
import type { ApiResult } from '@/api/core/ApiResult'

const getMyProfileMock = vi.fn()

vi.mock('@/lib/api/openapi-client', () => ({
  UsersService: {
    getMyProfile: (...args: unknown[]) => getMyProfileMock(...args),
  },
}))

const { fetchCurrentUser } = await import('@/features/auth/api/users')

function makeApiError(status: number, body: unknown, message = 'error'): ApiError {
  const request: ApiRequestOptions = { method: 'GET', url: '/api/v1/users/me' }
  const response: ApiResult = {
    url: '/api/v1/users/me',
    ok: status >= 200 && status < 300,
    status,
    statusText: message,
    body,
  }
  return new ApiError(request, response, message)
}

describe('fetchCurrentUser', () => {
  beforeEach(() => {
    getMyProfileMock.mockReset()
  })

  it('returns kind=ok with the parsed user on a 200 response', async () => {
    getMyProfileMock.mockResolvedValue({
      id: 'usr_1',
      role: 'student',
      email: 's1@student.rmit.edu.au',
    })
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') expect(result.user.id).toBe('usr_1')
  })

  it('returns kind=unverified on 403 + no_platform_user (top-level reason)', async () => {
    getMyProfileMock.mockRejectedValue(
      makeApiError(403, { reason: 'no_platform_user' }, 'Forbidden')
    )
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('unverified')
  })

  it('returns kind=unverified for the real backend shape (reason nested under error)', async () => {
    getMyProfileMock.mockRejectedValue(
      makeApiError(
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
    getMyProfileMock.mockRejectedValue(
      makeApiError(401, { reason: 'invalid_token' }, 'Unauthorized')
    )
    const result = await fetchCurrentUser()
    expect(result.kind).toBe('unauthenticated')
  })

  it('rethrows other ApiError responses (e.g. 500)', async () => {
    getMyProfileMock.mockRejectedValue(makeApiError(500, { error: 'oops' }, 'Server error'))
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError)
  })

  it('rethrows non-ApiError failures', async () => {
    getMyProfileMock.mockRejectedValue(new Error('network down'))
    await expect(fetchCurrentUser()).rejects.toThrow('network down')
  })

  it('does not treat 403 with a different reason as unverified', async () => {
    getMyProfileMock.mockRejectedValue(makeApiError(403, { reason: 'forbidden' }, 'Forbidden'))
    await expect(fetchCurrentUser()).rejects.toBeInstanceOf(ApiError)
  })
})
