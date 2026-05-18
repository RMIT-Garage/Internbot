import type { PlatformUser, RequestActor } from '../actor'
import type { Role } from '../../domain/value-objects/user-enums'

/**
 * AuthorizationService — port for caller-identity + role/ownership checks.
 *
 * Injected into every CQRS handler so authz lives behind a single seam
 * instead of being scattered as inline `if (platformUser.role === ...)`
 * checks. Throws `ForbiddenError` on denial; on allow returns the
 * `PlatformUser` so handlers don't have to re-extract from `actor.platformUser`.
 *
 * Three primitives cover every check in the codebase:
 *   - `requirePlatformUser` — caller authenticated and has a `users/{id}` doc
 *   - `requireRole`         — caller is one of the allowed roles
 *   - `requireSelfOrRole`   — caller owns the resource OR has a privileged role
 *
 * The default impl (`DefaultAuthorizationService`) is Firestore-free: pure
 * role logic against `actor.platformUser`. Tests can substitute a stub
 * without touching infrastructure.
 */
export interface AuthorizationService {
  /** Caller authenticated and has a platform user record. */
  requirePlatformUser(actor: RequestActor): PlatformUser

  /** Caller is one of the allowed roles. */
  requireRole(actor: RequestActor, allowed: Role | readonly Role[]): PlatformUser

  /**
   * Caller owns the resource (matches `ownerId`) OR has one of the
   * privileged roles. Use for "student sees own / coordinator sees any".
   *
   * `notOwnerReason` lets handlers surface a resource-specific reason
   * (`ticket_not_owner`, `student_not_owner`, etc.) on the thrown
   * `ForbiddenError`. Defaults to the generic `resource_not_owner`.
   */
  requireSelfOrRole(
    actor: RequestActor,
    ownerId: string,
    privileged: Role | readonly Role[],
    notOwnerReason?: string
  ): PlatformUser
}
