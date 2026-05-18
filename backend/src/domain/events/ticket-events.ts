import type { DomainEvent } from './domain-event'
import type { TicketActivity } from '../value-objects/ticket-activity'
import type { TicketReply } from '../value-objects/ticket-reply'

/**
 * A ticket changed state (e.g. `open → in_progress`). Drives a parent-doc
 * status update + activity row + version bump.
 */
export class TicketTransitioned implements DomainEvent {
  readonly kind = 'ticket_transitioned' as const
  readonly occurredAt: Date
  readonly activity: TicketActivity

  constructor(activity: TicketActivity) {
    this.activity = activity
    this.occurredAt = activity.createdAt
  }
}

/**
 * Someone added a reply to the conversation thread. Bumps `updatedAt` on the
 * parent doc but does NOT rotate `version` — replies are conversation items,
 * not state mutations.
 */
export class TicketReplied implements DomainEvent {
  readonly kind = 'ticket_replied' as const
  readonly occurredAt: Date
  readonly reply: TicketReply

  constructor(reply: TicketReply) {
    this.reply = reply
    this.occurredAt = reply.createdAt
  }
}

export type TicketDomainEvent = TicketTransitioned | TicketReplied
