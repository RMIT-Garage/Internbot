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
    const message =
      typeof parsed === 'object' && parsed && 'message' in parsed
        ? String((parsed as { message: unknown }).message)
        : `Request failed with status ${response.status}`
    throw new ApiError(response.status, parsed, message)
  }

  return parsed as T
}
