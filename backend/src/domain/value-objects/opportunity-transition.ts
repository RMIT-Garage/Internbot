import type { OpportunityStatus, OpportunityTransitionTarget } from './opportunity-enums'
import { ValidationError } from '../errors'

export interface OpportunityTransitionProps {
  readonly from: OpportunityStatus
  readonly to: OpportunityTransitionTarget
  readonly actorUserId: string
  readonly comment: string | undefined
  readonly createdAt: Date
}

export class OpportunityTransition {
  #props: Readonly<OpportunityTransitionProps>

  private constructor(props: OpportunityTransitionProps) {
    this.#props = props
  }

  static create(props: OpportunityTransitionProps): OpportunityTransition {
    if (props.actorUserId.trim().length === 0) {
      throw new ValidationError('actorUserId is required', 'invalid_transition', [
        { field: 'actorUserId', code: 'required', message: 'actorUserId cannot be empty' },
      ])
    }
    return new OpportunityTransition(props)
  }

  static rehydrate(props: OpportunityTransitionProps): OpportunityTransition {
    return new OpportunityTransition(props)
  }

  get from(): OpportunityStatus {
    return this.#props.from
  }
  get to(): OpportunityTransitionTarget {
    return this.#props.to
  }
  get actorUserId(): string {
    return this.#props.actorUserId
  }
  get comment(): string | undefined {
    return this.#props.comment
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
}
