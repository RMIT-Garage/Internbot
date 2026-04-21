import type { User } from '../../domain/entities/user'

/**
 * UserResult — application DTO returned by the GetUser query.
 *
 * Wraps a domain `User` (whose `version` field carries the concurrency token).
 * API serializers convert the entity to wire shape (ISO timestamps, no
 * `firebaseUid`, ETag derived from `user.version`) in `api/mappers/`.
 */
export interface UserResult {
  user: User
}
