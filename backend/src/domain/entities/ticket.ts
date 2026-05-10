import type { Role } from '../value-objects/user-enums'
import type { TicketStatus } from '../value-objects/ticket-enums'
import { TicketActivity } from '../value-objects/ticket-activity'
import { TicketReply } from '../value-objects/ticket-reply'
import { ConflictError, ForbiddenError, ValidationError } from '../errors'
import type { TicketDomainEvent } from '../events/ticket-events'
import { TicketTransitioned, TicketReplied } from '../events/ticket-events'

export interface TicketProps {
  readonly id: string
  readonly version: number
  readonly userId: string
  readonly subject: string
  readonly body: string
  readonly category: string | undefined
  readonly status: TicketStatus
  readonly createdAt: Date
  readonly updatedAt: Date
}

export interface TicketTransitionDetails {
  readonly to: TicketStatus
  readonly comment: string | undefined
}

interface AllowedTransition {
  readonly from: TicketStatus
  readonly to: TicketStatus
  readonly allowedRoles: ReadonlyArray<'student-owner' | 'coordinator'>
}

const ALLOWED_TRANSITIONS: readonly AllowedTransition[] = [
  { from: 'open', to: 'in_progress', allowedRoles: ['coordinator'] },
  { from: 'open', to: 'closed', allowedRoles: ['student-owner', 'coordinator'] },
  { from: 'in_progress', to: 'resolved', allowedRoles: ['coordinator'] },
  { from: 'in_progress', to: 'closed', allowedRoles: ['student-owner', 'coordinator'] },
  { from: 'resolved', to: 'closed', allowedRoles: ['student-owner', 'coordinator'] },
  { from: 'resolved', to: 'open', allowedRoles: ['student-owner'] },
  { from: 'closed', to: 'open', allowedRoles: ['student-owner'] },
] as const

/**
 * Ticket — support-ticket aggregate (spec §7.10 / §8.7).
 *
 * Lifecycle is fully transition-driven — there are no editable non-state
 * fields, so every write is a `transition` activity row plus a status change.
 * Reply threads live under `tickets/{id}/replies` and are independent of the
 * ticket's own ETag (replies do not rotate `version`).
 *
 * The aggregate emits domain events for transactional mutations:
 * `TicketTransitioned` (state change — rotates version) and `TicketReplied`
 * (conversation thread — no version rotation). The repository's `save()`
 * drains `pendingEvents` and translates each event to its Firestore writes.
 */
export class Ticket {
  #props: TicketProps
  #pendingEvents: TicketDomainEvent[] = []

  private constructor(props: TicketProps) {
    this.#props = props
  }

  static create(props: TicketProps): Ticket {
    validateRequiredText('userId', props.userId)
    validateRequiredText('subject', props.subject)
    validateRequiredText('body', props.body)
    return new Ticket({
      ...props,
      subject: props.subject.trim(),
      body: props.body.trim(),
      category:
        props.category === undefined || props.category.trim().length === 0
          ? undefined
          : props.category.trim(),
    })
  }

  static rehydrate(props: TicketProps): Ticket {
    return new Ticket(props)
  }

  static open(props: {
    id: string
    userId: string
    subject: string
    body: string
    category: string | undefined
    now: Date
  }): Ticket {
    return Ticket.create({
      id: props.id,
      version: 0,
      userId: props.userId,
      subject: props.subject,
      body: props.body,
      category: props.category,
      status: 'open',
      createdAt: props.now,
      updatedAt: props.now,
    })
  }

  get id(): string {
    return this.#props.id
  }
  get version(): number {
    return this.#props.version
  }
  get userId(): string {
    return this.#props.userId
  }
  get subject(): string {
    return this.#props.subject
  }
  get body(): string {
    return this.#props.body
  }
  get category(): string | undefined {
    return this.#props.category
  }
  get status(): TicketStatus {
    return this.#props.status
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }
  /**
   * Transient domain events emitted by mutation methods. Drained by
   * `TicketRepository.save` which translates each event into its
   * Firestore writes inside one transaction.
   */
  get pendingEvents(): readonly TicketDomainEvent[] {
    return this.#pendingEvents
  }

  /**
   * Apply a state transition. Throws when the (from → to) pair is not in the
   * allowed table, or when the actor's role is not permitted to perform the
   * transition. Emits a `TicketTransitioned` event for the repository's
   * `save()` to persist (parent status update + activity record) inside one
   * transaction.
   */
  transition(
    details: TicketTransitionDetails,
    actor: { userId: string; role: Role; isOwner: boolean },
    activityId: string,
    now: Date
  ): void {
    const allowed = ALLOWED_TRANSITIONS.find(
      (t) => t.from === this.#props.status && t.to === details.to
    )
    if (!allowed) {
      throw new ConflictError(
        `Cannot transition ticket from ${this.#props.status} to ${details.to}`,
        'invalid_state_transition'
      )
    }

    const actorKey = actor.role === 'coordinator' ? 'coordinator' : 'student-owner'
    if (actor.role === 'student' && !actor.isOwner) {
      throw new ForbiddenError(
        'Students may only transition their own tickets',
        'student_not_owner'
      )
    }
    if (!allowed.allowedRoles.includes(actorKey)) {
      throw new ForbiddenError(
        `Role ${actor.role} is not permitted to perform this transition`,
        'role_restricted_action'
      )
    }

    const from = this.#props.status
    this.#props = { ...this.#props, status: details.to, updatedAt: now }
    const activity = TicketActivity.transition({
      id: activityId,
      from,
      to: details.to,
      actorUserId: actor.userId,
      actorRole: actor.role,
      comment: details.comment,
      createdAt: now,
    })
    this.#pendingEvents.push(new TicketTransitioned(activity))
  }

  /**
   * Add a reply on this ticket. Bumps `updatedAt` but does *not* rotate
   * `version` — replies are conversation-thread items, not state mutations.
   * Emits a `TicketReplied` event drained by the repository's `save()`.
   * Returns the created VO so callers that need to surface it in their HTTP
   * response (e.g. POST replies) don't have to re-read the event list.
   */
  addReply(
    replyId: string,
    actor: { userId: string; role: Role; isOwner: boolean },
    text: string,
    now: Date
  ): TicketReply {
    if (actor.role === 'student' && !actor.isOwner) {
      throw new ForbiddenError('Students may only reply to their own tickets', 'student_not_owner')
    }

    const reply = TicketReply.create({
      id: replyId,
      authorUserId: actor.userId,
      authorRole: actor.role,
      text,
      createdAt: now,
    })
    this.#pendingEvents.push(new TicketReplied(reply))
    this.#props = { ...this.#props, updatedAt: now }
    return reply
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'missing_required_field', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

export const TICKET_SCHEMA_VERSION = 1 as const
