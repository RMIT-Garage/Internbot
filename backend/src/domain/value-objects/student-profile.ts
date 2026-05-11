import type { ProfileStatus } from './user-enums'
import type { AcademicInfo } from './academic-info'
import { ValidationError } from '../errors'

/**
 * StudentProfileProps — single-object constructor bag.
 */
export interface StudentProfileProps {
  readonly studentNumber: string
  readonly profileStatus: ProfileStatus
  readonly programCode: string | undefined
  readonly phone: string | undefined
  readonly academicInfo: AcademicInfo | undefined
  readonly semesterId: string | undefined
  readonly semesterSelectedAt: Date | undefined
}

/**
 * StudentProfile — value object embedded in the User aggregate for students.
 *
 * Immutable (value object): `with*` mutators return new instances; no
 * void-returning setters. State transitions (`markComplete`, `settleStatus`)
 * also return new instances. The owning `User` aggregate swaps its embedded
 * profile whenever a mutation occurs.
 *
 * Private `#props` field with getters (ECMAScript `#` for runtime privacy).
 * Two factories: `create` (validates, user input) / `rehydrate` (trusts
 * storage, no validation).
 *
 * Per WORKFLOW-API-SPEC.md §8.2A:
 *   - studentNumber is immutable after JIT bootstrap (derived from the
 *     RMIT student email and frozen on first authenticated request)
 *   - semesterSelectedAt is set on first successful semester selection only
 *   - profileStatus is derived server-side and not writable by clients
 *   - academicInfo.confirmedAt is stamped on the first incomplete→complete
 *     transition and preserved on subsequent edits
 */
export class StudentProfile {
  #props: Readonly<StudentProfileProps>

  private constructor(props: StudentProfileProps) {
    this.#props = props
  }

  /** User input path — validates required invariants. */
  static create(props: StudentProfileProps): StudentProfile {
    if (props.studentNumber.trim().length === 0) {
      throw new ValidationError('studentNumber is required', 'invalid_student_profile', [
        {
          field: 'studentProfile.studentNumber',
          code: 'required',
          message: 'studentNumber cannot be empty',
        },
      ])
    }
    return new StudentProfile(props)
  }

  /** Storage path — no validation, trust our own persisted data. */
  static rehydrate(props: StudentProfileProps): StudentProfile {
    return new StudentProfile(props)
  }

  get studentNumber(): string {
    return this.#props.studentNumber
  }
  get profileStatus(): ProfileStatus {
    return this.#props.profileStatus
  }
  get programCode(): string | undefined {
    return this.#props.programCode
  }
  get phone(): string | undefined {
    return this.#props.phone
  }
  get academicInfo(): AcademicInfo | undefined {
    return this.#props.academicInfo
  }
  get semesterId(): string | undefined {
    return this.#props.semesterId
  }
  get semesterSelectedAt(): Date | undefined {
    return this.#props.semesterSelectedAt
  }

  /**
   * Domain invariant: studentNumber is set once at bootstrap (derived from
   * the verified RMIT student email) and cannot change afterwards.
   * Same-value is a no-op; different value throws `ValidationError` with
   * `reason: 'immutable_field'`. `undefined` (absent from patch) is a no-op.
   */
  ensureStudentNumberImmutable(candidate: string | undefined): void {
    if (candidate === undefined || candidate === this.#props.studentNumber) return
    throw new ValidationError('studentNumber is immutable after first sync', 'immutable_field', [
      {
        field: 'studentProfile.studentNumber',
        code: 'immutable',
        message: 'studentNumber is set once at JIT bootstrap and cannot be changed',
      },
    ])
  }

  /**
   * Domain rule: a profile is complete when identity and academic
   * sub-fields are all present. Precondition for semester selection
   * (§7.6).
   */
  isComplete(): boolean {
    if (!this.#props.studentNumber) return false
    if (!this.#props.programCode) return false
    if (!this.#props.academicInfo) return false
    return this.#props.academicInfo.hasAllRequiredFields()
  }

  /** Returns the `ProfileStatus` this profile should have right now. */
  deriveStatus(): ProfileStatus {
    return this.isComplete() ? 'complete' : 'incomplete'
  }

  withProgramCode(code: string): StudentProfile {
    return StudentProfile.rehydrate({ ...this.#props, programCode: code })
  }

  withPhone(phone: string | undefined): StudentProfile {
    return StudentProfile.rehydrate({ ...this.#props, phone })
  }

  withAcademicInfo(info: AcademicInfo | undefined): StudentProfile {
    return StudentProfile.rehydrate({ ...this.#props, academicInfo: info })
  }

  withProfileStatus(status: ProfileStatus): StudentProfile {
    return StudentProfile.rehydrate({ ...this.#props, profileStatus: status })
  }

  withSemester(semesterId: string, selectedAt: Date): StudentProfile {
    // semesterSelectedAt is set only on the first successful selection.
    const preserved = this.#props.semesterSelectedAt ?? selectedAt
    return StudentProfile.rehydrate({
      ...this.#props,
      semesterId,
      semesterSelectedAt: preserved,
    })
  }

  /**
   * Reconcile `profileStatus` after field changes. Delegates to
   * `markComplete(now)` when the profile now satisfies `isComplete()`
   * (stamps `confirmedAt` on the first-complete transition; idempotent
   * afterwards). Otherwise resyncs `profileStatus` from `deriveStatus()`.
   *
   * Callers mutate fields via `with*`, then call `settleStatus` once to
   * arrive at a valid terminal state — no manual `isComplete ? :`
   * branching at the handler.
   */
  settleStatus(now: Date): StudentProfile {
    return this.isComplete() ? this.markComplete(now) : this.withProfileStatus(this.deriveStatus())
  }

  /**
   * Domain event: transition this profile to `complete` and stamp
   * `academicInfo.confirmedAt` with `now`. Idempotent — a profile already
   * complete keeps its original `confirmedAt` (no re-stamping).
   *
   * Precondition: `isComplete()` must be true. Callers that haven't
   * verified completeness should call `settleStatus(now)` instead.
   */
  markComplete(now: Date): StudentProfile {
    if (!this.isComplete()) {
      throw new Error('Cannot markComplete: profile does not satisfy isComplete()')
    }
    const academic = this.#props.academicInfo!
    const stampedAcademic =
      academic.confirmedAt !== undefined ? academic : academic.withConfirmedAt(now)
    return StudentProfile.rehydrate({
      ...this.#props,
      profileStatus: 'complete',
      academicInfo: stampedAcademic,
    })
  }
}
