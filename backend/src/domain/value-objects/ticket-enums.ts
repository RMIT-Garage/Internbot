export const ticketStatusValues = ['open', 'in_progress', 'resolved', 'closed'] as const
export type TicketStatus = (typeof ticketStatusValues)[number]

export const ticketActivityTypeValues = ['transition'] as const
export type TicketActivityType = (typeof ticketActivityTypeValues)[number]
