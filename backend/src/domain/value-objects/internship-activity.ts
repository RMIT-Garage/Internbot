import type { Role } from './user-enums'
import type { InternshipActivityType } from './internship-enums'
import { ValidationError } from '../errors'

export interface InternshipActivityProps {
  readonly id: string
  readonly type: InternshipActivityType
  readonly authorUserId: string
  readonly authorRole: Role
  readonly text: string | undefined
  readonly createdAt: Date
}

export class InternshipActivity {
  #props: InternshipActivityProps

  private constructor(props: InternshipActivityProps) {
    this.#props = props
  }

  static create(props: InternshipActivityProps): InternshipActivity {
    validateRequiredText('id', props.id)
    validateRequiredText('authorUserId', props.authorUserId)
    validateCommentText(props.type, props.text)
    return new InternshipActivity(props)
  }

  static apply(props: {
    id: string
    authorUserId: string
    authorRole: Role
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'apply', text: undefined })
  }

  static submitOffer(props: {
    id: string
    authorUserId: string
    authorRole: Role
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'submit_offer', text: undefined })
  }

  static edit(props: {
    id: string
    authorUserId: string
    authorRole: Role
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'edit', text: undefined })
  }

  static comment(props: {
    id: string
    authorUserId: string
    authorRole: Role
    text: string
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'comment' })
  }

  static approveOffer(props: {
    id: string
    authorUserId: string
    authorRole: Role
    text: string | undefined
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'approve_offer' })
  }

  static requestChanges(props: {
    id: string
    authorUserId: string
    authorRole: Role
    text: string
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'request_changes' })
  }

  static reject(props: {
    id: string
    authorUserId: string
    authorRole: Role
    text: string
    createdAt: Date
  }): InternshipActivity {
    return InternshipActivity.create({ ...props, type: 'reject' })
  }

  get id(): string {
    return this.#props.id
  }
  get type(): InternshipActivityType {
    return this.#props.type
  }
  get authorUserId(): string {
    return this.#props.authorUserId
  }
  get authorRole(): Role {
    return this.#props.authorRole
  }
  get text(): string | undefined {
    return this.#props.text
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
}

function validateRequiredText(field: string, value: string): void {
  if (value.trim().length === 0) {
    throw new ValidationError(`${field} is required`, 'invalid_internship_activity', [
      { field, code: 'required', message: `${field} cannot be empty` },
    ])
  }
}

function validateCommentText(type: InternshipActivityType, text: string | undefined): void {
  if (type !== 'comment' && type !== 'request_changes' && type !== 'reject') return
  if (text === undefined || text.trim().length === 0) {
    throw new ValidationError('text is required', 'missing_required_field', [
      { field: 'text', code: 'required', message: 'text cannot be empty' },
    ])
  }
}
