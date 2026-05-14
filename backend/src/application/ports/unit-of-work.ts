import type { UserRepository } from '../../domain/repositories/user-repository'
import type { SemesterRepository } from '../../domain/repositories/semester-repository'
import type { OpportunityRepository } from '../../domain/repositories/opportunity-repository'
import type { NotificationRepository } from '../../domain/repositories/notification-repository'
import type { InternshipRepository } from '../../domain/repositories/internship-repository'
import type { TicketRepository } from '../../domain/repositories/ticket-repository'

/**
 * UnitOfWork — coordinates a session of related **writes** and the
 * aggregate-loading reads that feed them.
 *
 * Per the project's pure-DDD/CQRS split: UoW is a **write-side** concern.
 * Query services live outside the UoW and are injected directly into query
 * handlers — `uow.execute` opens a Firestore transaction, so dragging the
 * read side through it would force every list/find query to participate in
 * a transaction it does not need (and pay the per-read cost).
 *
 * Every command handler receives a UnitOfWork via its `deps` and drives
 * work through `execute()`. The implementation owns the session lifecycle:
 *   1. Open a transaction
 *   2. Construct session-scoped repositories bound to that transaction
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
 * Session-scoped **write-side** repositories handed to a work function.
 * Each repo exposes the pure-DDD surface (`findById` / `save` / `delete`).
 * All read-side queries live on the corresponding `XxxQueryService` and
 * are injected directly into query handlers — never reached through the
 * UoW context.
 */
export interface UnitOfWorkContext {
  readonly users: UserRepository
  readonly semesters: SemesterRepository
  readonly opportunities: OpportunityRepository
  readonly internships: InternshipRepository
  readonly notifications: NotificationRepository
  readonly tickets: TicketRepository
}
