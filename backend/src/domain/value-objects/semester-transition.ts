import type { SemesterStatus } from './semester-enums'
import { ValidationError } from '../errors'

/**
 * SemesterTransitionProps — single-object constructor bag.
 */
export interface SemesterTransitionProps {
  readonly from: SemesterStatus
  readonly to: SemesterStatus
  readonly actorUserId: string
  readonly comment: string | undefined
  readonly createdAt: Date
}

/**
 * SemesterTransition — value object describing one entry in
 * `semesters/{id}/activity/{auto}`.
 *
 * Created by `TransitionSemesterCommandHandler` after the aggregate validates
 * the requested transition; the repository writes it alongside the parent
 * status update inside one Firestore transaction (see
 * `FirestoreSemesterRepository.recordTransition`).
 *
 * Immutable — constructed once, never mutated.
 */
export class SemesterTransition {
  #props: Readonly<SemesterTransitionProps>

  private constructor(props: SemesterTransitionProps) {
    this.#props = props
  }

  /** User-input path — validates required invariants. */
  static create(props: SemesterTransitionProps): SemesterTransition {
    if (props.actorUserId.trim().length === 0) {
      throw new ValidationError('actorUserId is required', 'invalid_transition_record')
    }
    return new SemesterTransition(props)
  }

  /** Storage path — no validation, trust persisted data. */
  static rehydrate(props: SemesterTransitionProps): SemesterTransition {
    return new SemesterTransition(props)
  }

  get from(): SemesterStatus {
    return this.#props.from
  }
  get to(): SemesterStatus {
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
