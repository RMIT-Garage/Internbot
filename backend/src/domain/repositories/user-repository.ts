import type { User } from '../entities/user'

/**
 * Write-side port over the `users` aggregate. Pure-DDD/CQRS surface
 * (`findById` / `save` / `delete`) plus the narrow `listCoordinators`
 * read used by command handlers for in-transaction notification fan-out.
 *
 * `save` is an upsert: when `aggregate.version === 0` it writes the user
 * doc together with the slim `userIdentities/{key}` uniqueness sentinel
 * (used by the auth-edge JIT bootstrap on first verified-email request);
 * otherwise it enforces optimistic concurrency against the persisted
 * `version`. Identity is intentionally *not* part of the update payload —
 * it is immutable for the lifetime of a User; callers that want to change
 * provider or providerUserId must mint a new aggregate.
 *
 * `listCoordinators` lives on the write-side repo (not on
 * `UserQueryService`) so command handlers can resolve coordinator
 * recipients **inside** the same Firestore transaction that writes the
 * source aggregate + notification fan-out — strongly consistent recipients
 * with no outbox / eventual-consistency window. Read-side `findByIdentity`
 * stays on `UserQueryService` (used by the auth-edge hydrator outside
 * any transaction).
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>
  save(user: User): Promise<void>
  delete(id: string): Promise<void>
  listCoordinators(): Promise<readonly User[]>
  /** Students with `studentProfile.semesterId` set to the given semester. */
  listStudentIdsBySemesterId(semesterId: string): Promise<readonly string[]>
}
