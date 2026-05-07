import type { Ticket } from '../../domain/entities/ticket'
import type { TicketActivity } from '../../domain/value-objects/ticket-activity'
import type { TicketReply } from '../../domain/value-objects/ticket-reply'
import type { TicketStatus } from '../../domain/value-objects/ticket-enums'

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
  readonly cursor: TicketListCursor | null
}
