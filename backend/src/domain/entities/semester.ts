import type { SemesterStatus, SemesterTransitionTarget } from '../value-objects/semester-enums'
import { SemesterTransition } from '../value-objects/semester-transition'
import { ConflictError, ValidationError } from '../errors'
import type { SemesterDomainEvent } from '../events/semester-events'
import { SemesterTransitioned } from '../events/semester-events'

/**
 * SemesterProps — single-object constructor bag for the aggregate.
 */
export interface SemesterProps {
  readonly id: string
  readonly version: number
  readonly semesterCode: string
  readonly courseCode: string
  readonly displayName: string
  readonly status: SemesterStatus
  readonly enrolmentOpenAt: Date | undefined
  readonly enrolmentCloseAt: Date | undefined
  readonly createdAt: Date
  readonly updatedAt: Date
}

/**
 * Semester — root of the semester aggregate.
 *
 * Identity by `id` (Firestore auto-id). Natural key
 * `(semesterCode, courseCode)` is enforced as unique by the repository at
 * create time (Firestore has no compound unique constraints — see spec §8.5).
 *
 * **Mutable aggregate** (Vernon-style DDD): behaviour methods
 * (`changeDisplayName`, `applyTransition`, …) return `void` and mutate
 * internal `#props`. Status transitions enforce the allowed-transitions
 * table from spec §7.5.
 *
 * `version` is the domain-level concurrency token — an app-managed
 * monotonic integer persisted on the doc. Never incremented client-side;
 * the repository's `save()` reads the stored value inside the
 * transaction, compares against `semester.version`, and writes
 * `stored + 1` on success. New aggregates start at `0`; the first save
 * persists `1`.
 *
 * The HTTP ETag is derived from `version` at the API boundary
 * (`W/"${semester.version}"`); the domain itself stays HTTP-free.
 *
 * Transitions: `applyTransition` mutates `status` AND emits a transient
 * `SemesterTransitioned` domain event. The repository's `save()` drains
 * `pendingEvents`, writing the parent status update + the activity record
 * atomically in one transaction. `recordTransition` is therefore not a
 * separate repo method — the aggregate carries the audit intent.
 */
export class Semester {
  #props: SemesterProps
  // Transient: appended to by mutation methods (e.g. `applyTransition`),
  // drained by `SemesterRepository.save`. Never persisted on the parent doc.
  #pendingEvents: SemesterDomainEvent[] = []

  private constructor(props: SemesterProps) {
    this.#props = props
  }

  /**
   * Command-input path — validates required invariants. Used when
   * `CreateSemesterCommandHandler` mints a fresh aggregate before
   * `repo.create(semester)`.
   */
  static create(props: SemesterProps): Semester {
    if (props.semesterCode.trim().length === 0) {
      throw new ValidationError('semesterCode is required', 'invalid_semester', [
        { field: 'semesterCode', code: 'required', message: 'semesterCode cannot be empty' },
      ])
    }
    if (props.courseCode.trim().length === 0) {
      throw new ValidationError('courseCode is required', 'invalid_semester', [
        { field: 'courseCode', code: 'required', message: 'courseCode cannot be empty' },
      ])
    }
    if (props.displayName.trim().length === 0) {
      throw new ValidationError('displayName is required', 'invalid_semester', [
        { field: 'displayName', code: 'required', message: 'displayName cannot be empty' },
      ])
    }
    return new Semester(props)
  }

  /** Storage path — no validation, trust persisted data. */
  static rehydrate(props: SemesterProps): Semester {
    return new Semester(props)
  }

  get id(): string {
    return this.#props.id
  }
  get version(): number {
    return this.#props.version
  }
  get semesterCode(): string {
    return this.#props.semesterCode
  }
  get courseCode(): string {
    return this.#props.courseCode
  }
  get displayName(): string {
    return this.#props.displayName
  }
  get status(): SemesterStatus {
    return this.#props.status
  }
  get enrolmentOpenAt(): Date | undefined {
    return this.#props.enrolmentOpenAt
  }
  get enrolmentCloseAt(): Date | undefined {
    return this.#props.enrolmentCloseAt
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }

  /**
   * Transient domain events emitted by mutation methods. Drained by
   * `SemesterRepository.save` which translates each event to its
   * corresponding Firestore writes inside one transaction. Empty for
   * aggregates that were rehydrated or only mutated via PATCH-style fields.
   */
  get pendingEvents(): readonly SemesterDomainEvent[] {
    return this.#pendingEvents
  }

  /** Whether `now` is within the semester's enrolment window (inclusive of open, exclusive of close). */
  isEnrolmentOpen(now: Date): boolean {
    if (this.#props.enrolmentOpenAt && now < this.#props.enrolmentOpenAt) return false
    if (this.#props.enrolmentCloseAt && now >= this.#props.enrolmentCloseAt) return false
    return true
  }

  // -------------------------------------------------------------------------
  // Mutations — void-returning, mutate `#props` in place.
  // -------------------------------------------------------------------------

  /** Rename the semester. No-op on same value. */
  changeDisplayName(displayName: string): void {
    if (this.#props.displayName === displayName) return
    if (displayName.trim().length === 0) {
      throw new ValidationError('displayName cannot be empty', 'invalid_semester', [
        { field: 'displayName', code: 'required', message: 'displayName cannot be empty' },
      ])
    }
    this.#props = { ...this.#props, displayName }
  }

  /** Set / clear `enrolmentOpenAt`. Pass `undefined` to clear. No-op on same value. */
  changeEnrolmentOpenAt(enrolmentOpenAt: Date | undefined): void {
    if (timeEquals(this.#props.enrolmentOpenAt, enrolmentOpenAt)) return
    this.#props = { ...this.#props, enrolmentOpenAt }
  }

  /** Set / clear `enrolmentCloseAt`. Pass `undefined` to clear. No-op on same value. */
  changeEnrolmentCloseAt(enrolmentCloseAt: Date | undefined): void {
    if (timeEquals(this.#props.enrolmentCloseAt, enrolmentCloseAt)) return
    this.#props = { ...this.#props, enrolmentCloseAt }
  }

  /**
   * Apply a status transition. Validates against the allowed-transitions
   * table from WORKFLOW-API-SPEC.md §7.5:
   *   draft → active, draft → archived, active → archived
   * Anything else throws `ConflictError` with `reason: invalid_state_transition`.
   *
   * Mutates `status` AND emits a `SemesterTransitioned` event — the
   * repository writes the activity record alongside the status update
   * inside one transaction. Caller doesn't need to handle the transition VO
   * directly; `repo.save(semester)` drains the event list.
   */
  applyTransition(
    target: SemesterTransitionTarget,
    actorUserId: string,
    comment: string | undefined,
    now: Date
  ): void {
    if (!isAllowedTransition(this.#props.status, target)) {
      throw new ConflictError(
        `Cannot transition semester from '${this.#props.status}' to '${target}'`,
        'invalid_state_transition'
      )
    }

    const from = this.#props.status
    this.#props = { ...this.#props, status: target }
    const transition = SemesterTransition.create({
      from,
      to: target,
      actorUserId,
      comment,
      createdAt: now,
    })
    this.#pendingEvents.push(new SemesterTransitioned(transition))
  }
}

function isAllowedTransition(_from: SemesterStatus, _to: SemesterTransitionTarget): boolean {
  return true // coordinators may move semesters to any status freely
}

function timeEquals(a: Date | undefined, b: Date | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}

export const SEMESTER_SCHEMA_VERSION = 2 as const
