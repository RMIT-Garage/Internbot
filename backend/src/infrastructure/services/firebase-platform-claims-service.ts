import type {
  PlatformClaims,
  PlatformClaimsService,
} from '../../application/ports/platform-claims-service'
import { adminAuth } from '../config/firebase-admin'

/**
 * Firebase-Auth-backed implementation of the `PlatformClaimsService` port.
 *
 * Writes custom claims via the Admin SDK. Tokens already minted before this
 * call continue to carry the previous claims until the client forces
 * `user.getIdToken(true)` — the frontend is responsible for refreshing the
 * token after POST /auth/sync returns 201.
 */
export class FirebasePlatformClaimsService implements PlatformClaimsService {
  async set(firebaseUid: string, claims: PlatformClaims): Promise<void> {
    await adminAuth.setCustomUserClaims(firebaseUid, {
      platformUserId: claims.platformUserId,
      role: claims.role,
    })
  }
}

export const firebasePlatformClaimsService: PlatformClaimsService =
  new FirebasePlatformClaimsService()
