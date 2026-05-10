import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest'
import { auth } from '@/lib/firebase/client'

vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.com')

const { apiFetch, ApiError } = await import('@/lib/api/client')

type MockedAuth = { currentUser: { getIdToken: Mock } | null }

const mockedAuth = auth as unknown as MockedAuth

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

describe('apiFetch', () => {
  let fetchMock: Mock

  beforeEach(() => {
    fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch
    mockedAuth.currentUser = null
  })

  it('does not attach Authorization when no user is signed in', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiFetch('/api/v1/ping')

    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
    expect(fetchMock.mock.calls[0]![0]).toBe('https://api.example.com/api/v1/ping')
  })

  it('attaches Bearer token from the signed-in user', async () => {
    const getIdToken = vi.fn().mockResolvedValue('TOKEN_A')
    mockedAuth.currentUser = { getIdToken }
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiFetch('/api/v1/me')

    expect(getIdToken).toHaveBeenCalledWith(false)
    const headers = (fetchMock.mock.calls[0]![1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer TOKEN_A')
  })

  it('retries once with a force-refreshed token on 401', async () => {
    const getIdToken = vi.fn().mockResolvedValueOnce('STALE').mockResolvedValueOnce('FRESH')
    mockedAuth.currentUser = { getIdToken }

    fetchMock
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, { status: 401 }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }))

    const result = await apiFetch<{ ok: boolean }>('/api/v1/me')

    expect(result).toEqual({ ok: true })
    expect(getIdToken).toHaveBeenNthCalledWith(1, false)
    expect(getIdToken).toHaveBeenNthCalledWith(2, true)
    const second = (fetchMock.mock.calls[1]![1] as RequestInit).headers as Record<string, string>
    expect(second.Authorization).toBe('Bearer FRESH')
  })

  it('does not retry when there is no signed-in user', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'nope' }, { status: 401 }))

    await expect(apiFetch('/api/v1/me')).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws ApiError with status and parsed body on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'bad' }, { status: 400 }))

    await expect(apiFetch('/api/v1/x')).rejects.toMatchObject({
      name: 'ApiError',
      status: 400,
      message: 'bad',
    })
  })

  it('JSON-stringifies request bodies and sets Content-Type', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }))

    await apiFetch('/api/v1/x', { method: 'POST', body: { a: 1 } })

    const init = fetchMock.mock.calls[0]![1] as RequestInit
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})
