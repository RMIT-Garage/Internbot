import type { Role } from './user-enums'
import type { TicketActivityType, TicketStatus } from './ticket-enums'
import { ValidationError } from '../errors'

export interface TicketActivityProps {
  readonly id: string
  readonly type: TicketActivityType
  readonly from: TicketStatus
  readonly to: TicketStatus
  readonly actorUserId: string
  readonly actorRole: Role
  readonly comment: string | undefined
  readonly createdAt: Date
}

/**
 * TicketActivity — reified record of a ticket-state transition.
 *
 * Spec §7.10: every ticket write is a state transition; the transition is the
 * audit row, parallel in shape to opportunity transition records. Stored under
 * `tickets/{id}/activity/{activityId}` with `actorUserId` (not `authorUserId`)
 * so the cross-resource user-activity feed (Phase 7) does not pick these up —
 * tickets have a separate per-resource history.
 */
export class TicketActivity {
  #props: TicketActivityProps

  private constructor(props: TicketActivityProps) {
    this.#props = props
  }

  static create(props: TicketActivityProps): TicketActivity {
    validateRequiredText('id', props.id)
    validateRequiredText('actorUserId', props.actorUserId)
    return new TicketActivity({ ...props, comment: trimOrUndefined(props.comment) })
  }

  static rehydrate(props: TicketActivityProps): TicketActivity {
    return new TicketActivity(props)
  }

  static transition(props: {
    id: string
    from: TicketStatus
    to: TicketStatus
    actorUserId: string
    actorRole: Role
    comment: string | undefined
    createdAt: Date
  }): TicketActivity {
    return TicketActivity.create({ ...props, type: 'transition' })
  }

  get id(): string {
    return this.#props.id
  }
  get type(): TicketActivityType {
    return this.#props.type
  }
  get from(): TicketStatus {
    return this.#props.from
  }
  get to(): TicketStatus {
    return this.#props.to
  }
  get actorUserId(): string {
    return this.#props.actorUserId
  }
  get actorRole(): Role {
    return this.#props.actorRole
  }
  get comment(): string | undefined {
    return this.#props.comment
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_ticket_activity', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

function trimOrUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 ? undefined : trimmed
}
