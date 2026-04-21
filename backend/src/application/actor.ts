import type { Role } from '../domain/value-objects/user-enums'

/**
 * PlatformUser — the minimal platform identity every authenticated handler
 * needs for authorization (role + ownership). Handlers that need the full
 * user aggregate re-fetch via UserRepository inside their UoW session.
 *
 * Null on `RequestActor.platformUser` means the caller authenticated but
 * has no `users/{id}` record yet. Only POST /auth/sync may run in this state.
 */
export interface PlatformUser {
  id: string
  role: Role
}

/**
 * RequestActor — the authenticated caller's identity for the current request.
 *
 * Resolved once at the api edge (token verification + custom-claims read) and
 * passed into every command/query as the `actor` field of the payload.
 * Inner layers never touch HTTP, tokens, or Firebase — they only see this shape.
 */
export interface RequestActor {
  firebaseUid: string
  email: string | undefined
  platformUser: PlatformUser | null
}
