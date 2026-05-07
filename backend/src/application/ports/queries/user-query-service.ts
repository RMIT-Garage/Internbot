import type { User } from '../../../domain/entities/user'
import type { UserIdentityLookup } from '../../../domain/value-objects/user-identity'

/**
 * Read-side port for the `users` aggregate. Standalone singleton — not on
 * the UnitOfWork. The identity-lookup query is also used by the auth-edge
 * JIT bootstrap flow (read-then-create), but uniqueness is enforced inside
 * the write-side `save()` against the `userIdentities/{key}` sentinel —
 * never use this lookup as a TOCTOU guard outside a transaction.
 *
 * `listCoordinators` lives on the write-side `UserRepository`, not here —
 * command-handler fan-out reads it **inside** the txn for strongly
 * consistent recipients.
 */
export interface UserQueryService {
  findById(id: string): Promise<User | null>
  findByIdentity(identity: UserIdentityLookup): Promise<User | null>
}
