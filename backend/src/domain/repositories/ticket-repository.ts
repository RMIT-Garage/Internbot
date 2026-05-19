import type { Ticket } from '../entities/ticket'

/**
 * Write-side port over the `tickets` aggregate. Pure-DDD/CQRS surface —
 * exactly three methods (`findById`, `save`, `delete`).
 *
 * `save` is an upsert: `aggregate.version === 0` → first-write; else
 * optimistic-lock update. Drains `pendingEvents` and translates each event:
 *   - `TicketTransitioned` (emitted by `transition`) → rotate version,
 *     write status update, append activity row.
 *   - `TicketReplied` (emitted by `addReply`) → bump `updatedAt` only,
 *     append reply row, do NOT rotate version (replies are conversation-
 *     thread items, not state mutations).
 *
 * Read-side `list` lives on `TicketQueryService`.
 */
export interface TicketRepository {
  findById(id: string): Promise<Ticket | null>
  save(ticket: Ticket): Promise<void>
  delete(id: string): Promise<void>
}
