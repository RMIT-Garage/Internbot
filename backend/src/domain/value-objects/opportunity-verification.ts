import type { OpportunityStatus, OpportunityVerificationDecision } from './opportunity-enums'
import { ValidationError } from '../errors'

export interface OpportunityVerificationProps {
  readonly from: OpportunityStatus
  readonly to: OpportunityStatus
  readonly decision: OpportunityVerificationDecision
  readonly actorUserId: string
  readonly comment: string | undefined
  readonly createdAt: Date
}

export class OpportunityVerification {
  #props: Readonly<OpportunityVerificationProps>

  private constructor(props: OpportunityVerificationProps) {
    this.#props = props
  }

  static create(props: OpportunityVerificationProps): OpportunityVerification {
    if (props.actorUserId.trim().length === 0) {
      throw new ValidationError('actorUserId is required', 'invalid_verification', [
        { field: 'actorUserId', code: 'required', message: 'actorUserId cannot be empty' },
      ])
    }
    return new OpportunityVerification(props)
  }

  static rehydrate(props: OpportunityVerificationProps): OpportunityVerification {
    return new OpportunityVerification(props)
  }

  get from(): OpportunityStatus {
    return this.#props.from
  }
  get to(): OpportunityStatus {
    return this.#props.to
  }
  get decision(): OpportunityVerificationDecision {
    return this.#props.decision
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
