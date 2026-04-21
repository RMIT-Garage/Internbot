import type { RequestActor } from '../../application/actor'
import { ApiError } from '../errors'

/**
 * Resolve the user-addressed `:id` path segment, expanding `me` to the
 * caller's platform user id. Returns the effective id for downstream lookup.
 *
 * Throws 401 if the caller has `platformUser === null` (pre-sync state) —
 * `me` cannot be resolved without a platform identity.
 */
export function resolveUserId(rawId: string, actor: RequestActor): string {
  if (rawId !== 'me') return rawId
  const platformUser = actor.platformUser
  if (!platformUser) {
    throw new ApiError(
      401,
      'Unauthorized',
      'Cannot resolve `me`: caller has no platform user record. Call POST /api/v1/auth/sync first.'
    )
  }
  return platformUser.id
}
