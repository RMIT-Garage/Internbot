import type { User } from '../entities/user'
import type { IdentityProvider, UserIdentityLookup } from '../value-objects/user-identity'

// Re-export so existing callers (handlers, infra) keep their imports stable.
export type { IdentityProvider, UserIdentityLookup }

/**
 * UserRepository — session-scoped read/write port over the `users` aggregate.
 *
 * Obtained from `UnitOfWorkContext.users` inside `uow.execute(...)`.
 * Domain-layer port: implementations live in `infrastructure/` and must
 * never leak persistence types (Firestore Timestamp, DocumentSnapshot,
 * etc.) through this interface.
 *
 * Reads return `User | null` (the aggregate root directly) — every returned
 * `User` carries its `identity` VO, populated from the denormalised
 * `users/{id}.identity` field. The aggregate carries its own concurrency
 * token as `user.version`; `save(user)` uses that token as the optimistic-
 * lock precondition.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByIdentity(identity: UserIdentityLookup): Promise<User | null>

  /**
   * Insert a freshly-constructed `User` aggregate. Used by `POST
   * /auth/sync` on the first call. The aggregate must already carry a
   * non-empty id (the application service mints it via `IdGenerator`
   * before construction) and a populated `identity` VO. The implementation
   * writes the user doc (with denormalised identity) and the slim
   * `userIdentities/{key}` uniqueness sentinel atomically — identity
   * uniqueness enforcement lives there, not in the handler.
   */
  create(user: User): Promise<void>

  /**
   * Persist mutations to an existing `User` aggregate with optimistic
   * concurrency enforcement.
   *
   * Reads the current document version inside the active transaction;
   * rejects with `PreconditionFailedError` if it does not match
   * `user.version`. Callers that want to bypass the check (e.g. system
   * migrations) should mint a new aggregate instead.
   *
   * Identity is intentionally *not* part of the update payload — it is
   * immutable for the lifetime of a User. Callers that want to change
   * provider or providerUserId must mint a new aggregate.
   *
   * Does not mutate the passed-in `user.version`. After a successful
   * write, Firestore produces a new `updateTime` — callers that need the
   * refreshed version must re-read.
   */
  save(user: User): Promise<void>
}
