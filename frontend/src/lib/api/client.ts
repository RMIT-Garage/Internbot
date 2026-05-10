import { auth } from '@/lib/firebase/client'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getAuthHeader(forceRefresh: boolean): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) return {}
  const token = await user.getIdToken(forceRefresh)
  return { Authorization: `Bearer ${token}` }
}

export interface ApiFetchInit extends Omit<RequestInit, 'body'> {
  body?: unknown
}

export async function apiFetch<T = unknown>(path: string, init: ApiFetchInit = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set — cannot call backend API')
  }

  const { body, headers, ...rest } = init
  const hasBody = body !== undefined

  const send = async (forceRefresh: boolean) => {
    const authHeader = await getAuthHeader(forceRefresh)
    return fetch(`${API_BASE_URL}${path}`, {
      ...rest,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...authHeader,
        ...(headers ?? {}),
      },
      body: hasBody ? JSON.stringify(body) : undefined,
    })
  }

  let response = await send(false)

  if (response.status === 401 && auth.currentUser) {
    response = await send(true)
  }

  const contentType = response.headers.get('content-type') ?? ''
  const parsed: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    throw new ApiError(response.status, parsed, extractErrorMessage(parsed, response.status))
  }

  return parsed as T
}

/**
 * Pick a human-readable message out of the backend's RFC 9457 error body
 * (see backend/src/api/middleware/error-handler.ts):
 *   { type, title, status, detail, error: { code, message, reason?, fields? } }
 * Falls back through `detail` → `error.message` → `message` → status string.
 */
function extractErrorMessage(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null) {
    const b = body as { detail?: unknown; message?: unknown; error?: unknown }
    if (typeof b.detail === 'string' && b.detail) return b.detail
    if (typeof b.error === 'object' && b.error !== null) {
      const inner = (b.error as { message?: unknown }).message
      if (typeof inner === 'string' && inner) return inner
    }
    if (typeof b.message === 'string' && b.message) return b.message
  }
  if (typeof body === 'string' && body) return body
  return `Request failed with status ${status}`
}
