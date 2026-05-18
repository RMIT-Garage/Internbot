import { adminDb } from '../config/firebase-admin'
import type { User } from '../../domain/entities/user'
import type { UserIdentityLookup } from '../../domain/value-objects/user-identity'
import type { UserQueryService } from '../../application/ports/queries/user-query-service'
import { NotFoundError } from '../../domain/errors'
import {
  USER_COLLECTION,
  USER_IDENTITY_SENTINEL_COLLECTION,
  parseUser,
  parseUserIdentitySentinel,
  userIdentitySentinelDocId,
} from './firestore-user-repository'
import { translateFirestoreErrors } from './translate-firestore-errors'

/**
 * Firestore impl of the read-side `UserQueryService`. Singleton — not
 * bound to a Firestore Transaction. The identity-lookup query is also
 * used by the auth-edge JIT bootstrap flow (read-then-create), but
 * uniqueness is enforced inside the write-side `save()` against the
 * `userIdentities/{key}` sentinel — never use this lookup as a TOCTOU
 * guard outside a transaction.
 */
export class FirestoreUserQueryService implements UserQueryService {
  async findById(id: string): Promise<User | null> {
    return translateFirestoreErrors(
      async () => {
        const snap = await adminDb.collection(USER_COLLECTION).doc(id).get()
        if (!snap.exists) return null
        return parseUser(snap.id, snap.data())
      },
      { op: 'users.findById', resource: 'User', id }
    )
  }

  async findByIdentity(identity: UserIdentityLookup): Promise<User | null> {
    return translateFirestoreErrors(
      async () => {
        const sentinelRef = adminDb
          .collection(USER_IDENTITY_SENTINEL_COLLECTION)
          .doc(userIdentitySentinelDocId(identity))
        const sentinelSnap = await sentinelRef.get()
        if (!sentinelSnap.exists) return null

        const sentinel = parseUserIdentitySentinel(sentinelRef.id, sentinelSnap.data())
        const userSnap = await adminDb.collection(USER_COLLECTION).doc(sentinel.userId).get()
        if (!userSnap.exists) {
          // Sentinel pointing at a missing user is a data-integrity bug,
          // not a user-facing 404. Surface loudly so it's caught in CI.
          throw new NotFoundError('User', sentinel.userId)
        }
        return parseUser(userSnap.id, userSnap.data())
      },
      { op: 'users.findByIdentity', resource: 'User' }
    )
  }
}

/** Production singleton. */
export const firestoreUserQueryService: UserQueryService = new FirestoreUserQueryService()
