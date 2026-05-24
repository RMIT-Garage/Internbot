import type { Ticket } from '../../domain/entities/ticket'
import type { TicketActivity } from '../../domain/value-objects/ticket-activity'
import type { TicketReply } from '../../domain/value-objects/ticket-reply'
import type { TicketRepository } from '../../domain/repositories/ticket-repository'

export interface TicketResult {
  readonly ticket: Ticket
}

export interface TicketReplyResult {
  readonly reply: TicketReply
}

export interface TicketActivityResult {
  readonly activity: TicketActivity
}

export interface TicketListResult {
  readonly items: readonly Ticket[]
  readonly nextPageToken: string | null
}

export interface TicketListResultWithCursor extends TicketListResult {
  readonly cursor: TicketRepository | null
}
