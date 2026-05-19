import type { AuthorizationService } from '../../application/ports/authorization-service'
import type { PlatformUser, RequestActor } from '../../application/actor'
import type { Role } from '../../domain/value-objects/user-enums'
import { ForbiddenError } from '../../domain/errors'

/**
 * Default `AuthorizationService` impl. Firestore-free — pure role logic
 * against `actor.platformUser`. Wired as a singleton in the api factory.
 */
export class DefaultAuthorizationService implements AuthorizationService {
  requirePlatformUser(actor: RequestActor): PlatformUser {
    if (!actor.platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    return actor.platformUser
  }

  requireRole(actor: RequestActor, allowed: Role | readonly Role[]): PlatformUser {
    const user = this.requirePlatformUser(actor)
    if (!toRoleArray(allowed).includes(user.role)) {
      throw new ForbiddenError(
        `Role '${user.role}' is not allowed for this operation`,
        'role_restricted_action'
      )
    }
    return user
  }

  requireSelfOrRole(
    actor: RequestActor,
    ownerId: string,
    privileged: Role | readonly Role[],
    notOwnerReason: string = 'resource_not_owner'
  ): PlatformUser {
    const user = this.requirePlatformUser(actor)
    if (user.id === ownerId) return user
    if (toRoleArray(privileged).includes(user.role)) return user
    throw new ForbiddenError('Caller is not the resource owner', notOwnerReason)
  }
}

function toRoleArray(r: Role | readonly Role[]): readonly Role[] {
  return Array.isArray(r) ? r : [r as Role]
}

/** Production singleton. */
export const defaultAuthorizationService: AuthorizationService = new DefaultAuthorizationService()
