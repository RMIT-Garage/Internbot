import type { Role } from '../../domain/value-objects/user-enums'

/**
 * Claims written onto a Firebase Auth user so every subsequent ID token
 * carries the platform identity without requiring a Firestore lookup.
 */
export interface PlatformClaims {
  platformUserId: string
  role: Role
}

/**
 * PlatformClaimsService — application-layer port for updating the caller's
 * authentication-provider identity claims.
 *
 * Consumed by `SyncUserCommandHandler` after the user document is created
 * (or re-affirmed) so the NEXT ID token the caller mints contains the
 * platform `id` and `role`. The auth middleware reads those claims off the
 * token; without this step it would have to hit Firestore on every request.
 *
 * Production implementation: `FirebasePlatformClaimsService`
 * (infrastructure/services/firebase-platform-claims-service.ts).
 */
export interface PlatformClaimsService {
  set(firebaseUid: string, claims: PlatformClaims): Promise<void>
}
