import type { User } from '../entities/user'

/**
 * UserRepository — session-scoped read/write port over the `users` aggregate.
 *
 * Obtained from `UnitOfWorkContext.users` inside `uow.execute(...)`.
 * Domain-layer port: implementations live in `infrastructure/` and must
 * never leak persistence types (Firestore Timestamp, DocumentSnapshot,
 * etc.) through this interface.
 *
 * Reads return `User | null` (the aggregate root directly). The aggregate
 * carries its own concurrency token as `user.version`; `save(user)` uses
 * that token as the optimistic-lock precondition.
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>
  findByFirebaseUid(firebaseUid: string): Promise<User | null>

  /**
   * Insert a freshly-created `User` aggregate. Used by `POST /auth/sync`
   * on the first call. `user.version` on a freshly-created aggregate
   * is 0 (not yet persisted); after `create` returns, the document's
   * `updateTime` becomes the new version (but the passed-in instance is
   * not mutated — callers discard it and reload if needed).
   */
  create(user: User): Promise<{ id: string }>

  /**
   * Persist mutations to an existing `User` aggregate with optimistic
   * concurrency enforcement.
   *
   * Reads the current document version inside the active transaction;
   * rejects with `PreconditionFailedError` if it does not match
   * `user.version`. Callers that want to bypass the check (e.g. system
   * migrations) should mint a new aggregate instead.
   *
   * Does not mutate the passed-in `user.version`. After a successful
   * write, Firestore produces a new `updateTime` — callers that need the
   * refreshed version must re-read.
   */
  save(user: User): Promise<void>
}
