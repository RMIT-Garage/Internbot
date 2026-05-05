import type { Role } from './user-enums'
import { ValidationError } from '../errors'

export interface TicketReplyProps {
  readonly id: string
  readonly authorUserId: string
  readonly authorRole: Role
  readonly text: string
  readonly createdAt: Date
}

export class TicketReply {
  #props: TicketReplyProps

  private constructor(props: TicketReplyProps) {
    this.#props = props
  }

  static create(props: TicketReplyProps): TicketReply {
    validateRequiredText('id', props.id)
    validateRequiredText('authorUserId', props.authorUserId)
    validateReplyText(props.text)
    return new TicketReply({ ...props, text: props.text.trim() })
  }

  static rehydrate(props: TicketReplyProps): TicketReply {
    return new TicketReply(props)
  }

  get id(): string {
    return this.#props.id
  }
  get authorUserId(): string {
    return this.#props.authorUserId
  }
  get authorRole(): Role {
    return this.#props.authorRole
  }
  get text(): string {
    return this.#props.text
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_ticket_reply', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

function validateReplyText(text: string): void {
  if (text.trim().length === 0) {
    throw new ValidationError('text is required', 'missing_required_field', [
      { field: 'text', code: 'required', message: 'text cannot be empty' },
    ])
  }
}
