import type { Ticket } from '../entities/ticket'
import type { TicketActivity } from '../value-objects/ticket-activity'
import type { TicketReply } from '../value-objects/ticket-reply'
import type { TicketStatus } from '../value-objects/ticket-enums'

export interface TicketListCursor {
  readonly sortField: 'createdAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly lastValue: Date
  readonly lastDocId: string
}

export interface TicketListFilter {
  readonly userId: string | undefined
  readonly status: TicketStatus | undefined
  readonly limit: number
  readonly sortDirection: 'asc' | 'desc'
  readonly cursor: TicketListCursor | undefined
}

export interface TicketListPage {
  readonly items: readonly Ticket[]
  readonly nextCursor: TicketListCursor | null
}

export interface TicketRepository {
  findById(id: string): Promise<Ticket | null>
  list(filter: TicketListFilter): Promise<TicketListPage>
  create(ticket: Ticket): Promise<void>
  /**
   * Persist a state transition: rotate the ticket's stored version (OCC),
   * append the activity record, and bump `updatedAt`. Atomic via UoW txn.
   */
  applyTransition(ticket: Ticket, activity: TicketActivity): Promise<void>
  /**
   * Append a reply and bump the parent's `updatedAt` without rotating its
   * version — replies are conversation-thread items, not state mutations.
   */
  addReply(ticketId: string, reply: TicketReply, now: Date): Promise<void>
}
