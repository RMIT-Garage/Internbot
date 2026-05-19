import type { DomainEvent } from './domain-event'
import type { SemesterTransition } from '../value-objects/semester-transition'

/**
 * The semester moved between lifecycle states (`draft → active`,
 * `draft → archived`, `active → archived`). Drives a status update on the
 * parent doc + a new activity row + a version bump.
 */
export class SemesterTransitioned implements DomainEvent {
  readonly kind = 'semester_transitioned' as const
  readonly occurredAt: Date
  readonly transition: SemesterTransition

  constructor(transition: SemesterTransition) {
    this.transition = transition
    this.occurredAt = transition.createdAt
  }
}

export type SemesterDomainEvent = SemesterTransitioned
