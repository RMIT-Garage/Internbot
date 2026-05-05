import type { UserRepository } from '../../domain/repositories/user-repository'
import type { SemesterRepository } from '../../domain/repositories/semester-repository'
import type { OpportunityRepository } from '../../domain/repositories/opportunity-repository'
import type { NotificationRepository } from '../../domain/repositories/notification-repository'
import type { InternshipRepository } from '../../domain/repositories/internship-repository'

/**
 * UnitOfWork — coordinates a session of related reads and writes.
 *
 * Design per `backend/CLAUDE.md` — every CQRS command or query handler
 * receives a UnitOfWork via its `deps` and drives work through `execute()`.
 * The UoW implementation (Firestore in production) owns the session lifecycle:
 *   1. Open a transaction
 *   2. Construct session-scoped repositories
 *   3. Hand a `UnitOfWorkContext` to the caller's work function
 *   4. Commit on return, roll back on throw
 *
 * Handlers never create transactions, call Firestore directly, or manage
 * commit/rollback themselves — that's the whole point of injecting the UoW.
 */
export interface UnitOfWork {
  execute<T>(work: (ctx: UnitOfWorkContext) => Promise<T>): Promise<T>
}

/**
 * Session-scoped repositories handed to a work function.
 * Every repository returned from the context is bound to the same underlying
 * transaction — all reads see a consistent snapshot, all writes commit atomically.
 */
export interface UnitOfWorkContext {
  readonly users: UserRepository
  readonly semesters: SemesterRepository
  readonly opportunities: OpportunityRepository
  readonly internships: InternshipRepository
  readonly notifications: NotificationRepository
}
