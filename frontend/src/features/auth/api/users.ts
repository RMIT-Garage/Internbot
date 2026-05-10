import { apiFetch, ApiError } from '@/lib/api/client'
import type { UserResponse } from '@/types/api'

export type CurrentUserResult =
  | { kind: 'ok'; user: UserResponse }
  | { kind: 'unverified' }
  | { kind: 'unauthenticated' }

/**
 * GET /api/v1/users/me with the auth-state mapped onto a result variant.
 *
 * The backend JIT-creates the platform `users/{id}` doc on the first call
 * from a verified email. While the email is unverified, the hydrator
 * refuses to mint the doc and the route returns 403 with
 * `{ reason: "no_platform_user" }`. We surface that as `unverified`.
 */
export async function fetchCurrentUser(): Promise<CurrentUserResult> {
  try {
    const user = await apiFetch<UserResponse>('/api/v1/users/me')
    return { kind: 'ok', user }
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 403 && extractReason(error.body) === 'no_platform_user') {
        return { kind: 'unverified' }
      }
      if (error.status === 401) {
        return { kind: 'unauthenticated' }
      }
    }
    throw error
  }
}

function extractReason(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'reason' in body) {
    const reason = (body as { reason: unknown }).reason
    if (typeof reason === 'string') return reason
  }
  return undefined
}
