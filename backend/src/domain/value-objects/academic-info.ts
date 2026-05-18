import type { ProgramLevel, ProgramStatus, StudyLoad } from './user-enums'
import { ValidationError } from '../errors'

/**
 * AcademicInfoProps — single-object constructor bag. All fields `readonly`
 * so `{ ...this.#props, x }` in `with*` helpers is type-safe.
 */
export interface AcademicInfoProps {
  readonly programName: string
  readonly programLevel: ProgramLevel
  readonly unitsAttempted: number
  readonly creditUnitsEarned: number
  readonly gpa: number
  readonly currentStudyLoad: StudyLoad
  readonly programStatus: ProgramStatus | undefined
  readonly majors: readonly string[] | undefined
  readonly minors: readonly string[] | undefined
  readonly notes: string | undefined
  readonly confirmedAt: Date | undefined
}

/**
 * AcademicInfo — value object embedded in StudentProfile.
 *
 * Immutable by convention (value object): `with*` mutators return new
 * instances; there are no void-returning setters. Private `#props` field
 * with getters — ECMAScript private (`#`) so encapsulation is enforced at
 * runtime, not just by the TypeScript compiler.
 *
 * Two factories:
 *   - `create(props)` — user input path. Validates domain rules; throws
 *     `ValidationError` on failure.
 *   - `rehydrate(props)` — storage path. No validation (trust our own
 *     persisted data); the storage mapper uses this.
 *
 * Per WORKFLOW-API-SPEC.md §8.2B: `confirmedAt` records the first write
 * that transitioned `profileStatus` to `complete`. Preserved on subsequent
 * edits — `StudentProfile.markComplete` is idempotent.
 */
export class AcademicInfo {
  #props: Readonly<AcademicInfoProps>

  private constructor(props: AcademicInfoProps) {
    this.#props = props
  }

  /**
   * Build a fresh `AcademicInfo` from user input. Rejects invalid domain
   * state with `ValidationError` — callers at the command-handler boundary
   * map this to HTTP 400 via the error handler.
   */
  static create(props: AcademicInfoProps): AcademicInfo {
    if (props.programName.trim().length === 0) {
      throw new ValidationError('programName is required', 'invalid_academic_info', [
        {
          field: 'studentProfile.academicInfo.programName',
          code: 'required',
          message: 'programName cannot be empty',
        },
      ])
    }
    if (!Number.isFinite(props.unitsAttempted) || props.unitsAttempted < 0) {
      throw new ValidationError(
        'unitsAttempted must be a non-negative number',
        'invalid_academic_info'
      )
    }
    if (!Number.isFinite(props.creditUnitsEarned) || props.creditUnitsEarned < 0) {
      throw new ValidationError(
        'creditUnitsEarned must be a non-negative number',
        'invalid_academic_info'
      )
    }
    if (!Number.isFinite(props.gpa) || props.gpa < 0 || props.gpa > 4) {
      throw new ValidationError('gpa must be between 0 and 4', 'invalid_academic_info')
    }
    return new AcademicInfo(props)
  }

  /**
   * Hydrate from persisted storage. Skips validation — the storage mapper
   * is trusted (if it produced an invalid shape, that's a bug to catch in
   * the schema layer, not here).
   */
  static rehydrate(props: AcademicInfoProps): AcademicInfo {
    return new AcademicInfo(props)
  }

  get programName(): string {
    return this.#props.programName
  }
  get programLevel(): ProgramLevel {
    return this.#props.programLevel
  }
  get unitsAttempted(): number {
    return this.#props.unitsAttempted
  }
  get creditUnitsEarned(): number {
    return this.#props.creditUnitsEarned
  }
  get gpa(): number {
    return this.#props.gpa
  }
  get currentStudyLoad(): StudyLoad {
    return this.#props.currentStudyLoad
  }
  get programStatus(): ProgramStatus | undefined {
    return this.#props.programStatus
  }
  get majors(): readonly string[] | undefined {
    return this.#props.majors
  }
  get minors(): readonly string[] | undefined {
    return this.#props.minors
  }
  get notes(): string | undefined {
    return this.#props.notes
  }
  get confirmedAt(): Date | undefined {
    return this.#props.confirmedAt
  }

  /**
   * Domain rule: the six fields the spec requires for profile completeness
   * (see §8.2A note "A profile is considered complete only when all six
   * required fields below are present").
   */
  hasAllRequiredFields(): boolean {
    return (
      this.#props.programName.length > 0 &&
      this.#props.programLevel !== undefined &&
      Number.isFinite(this.#props.unitsAttempted) &&
      Number.isFinite(this.#props.creditUnitsEarned) &&
      Number.isFinite(this.#props.gpa) &&
      this.#props.currentStudyLoad !== undefined
    )
  }

  /** Structural equality for value-object semantics. */
  equals(other: AcademicInfo): boolean {
    return (
      this.#props.programName === other.#props.programName &&
      this.#props.programLevel === other.#props.programLevel &&
      this.#props.unitsAttempted === other.#props.unitsAttempted &&
      this.#props.creditUnitsEarned === other.#props.creditUnitsEarned &&
      this.#props.gpa === other.#props.gpa &&
      this.#props.currentStudyLoad === other.#props.currentStudyLoad &&
      this.#props.programStatus === other.#props.programStatus &&
      sameArray(this.#props.majors, other.#props.majors) &&
      sameArray(this.#props.minors, other.#props.minors) &&
      this.#props.notes === other.#props.notes &&
      timeEquals(this.#props.confirmedAt, other.#props.confirmedAt)
    )
  }

  /** Return a copy with `confirmedAt` set — used on the first complete transition. */
  withConfirmedAt(confirmedAt: Date): AcademicInfo {
    return AcademicInfo.rehydrate({ ...this.#props, confirmedAt })
  }
}

function sameArray(a: readonly string[] | undefined, b: readonly string[] | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function timeEquals(a: Date | undefined, b: Date | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.getTime() === b.getTime()
}
