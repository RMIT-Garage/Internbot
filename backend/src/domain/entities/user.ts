import type { OnboardingStage, Role, UserStatus } from '../value-objects/user-enums'
import type { AcademicInfo } from '../value-objects/academic-info'
import type { StudentProfile } from '../value-objects/student-profile'
import { ForbiddenError } from '../errors'

/**
 * UserProps — single-object constructor bag for the aggregate.
 */
export interface UserProps {
  readonly id: string
  readonly version: number
  readonly firebaseUid: string
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
  readonly onboardingStage: OnboardingStage
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly displayName: string | undefined
  readonly studentProfile: StudentProfile | undefined
}

/**
 * User — root of the user aggregate.
 *
 * Identity by `id` (Firestore auto-id). `firebaseUid` bridges to Firebase
 * Auth and is never used as a foreign key (per WORKFLOW-API-SPEC.md §6).
 *
 * **Mutable aggregate** (Vernon-style DDD): behaviour methods
 * (`changePhone`, `setAcademicInfo`, ...) return `void` and mutate the
 * aggregate's internal state via a private `#props` field. State
 * transitions (e.g. `profileStatus`, `onboardingStage`, `confirmedAt`
 * stamping) happen inside the mutation — handlers don't orchestrate
 * derived state.
 *
 * Private `#props` field (ECMAScript `#` for runtime privacy). External
 * readers go through getters.
 *
 * Two factories:
 *   - `create(props)` — command-handler input path. Validates required
 *     invariants.
 *   - `rehydrate(props)` — storage path. No validation (trust our own
 *     data); the Firestore mapper calls this.
 *
 * `version` is the domain-level concurrency token, set from Firestore's
 * `updateTime.toMillis()` on load. **Never incremented client-side** —
 * Firestore's `updateTime` is the authoritative source, and the
 * repository's `save()` uses `user.version` as the If-Match precondition.
 * On a successful write, Firestore produces a new `updateTime`; the next
 * load will reflect it. The HTTP ETag is derived from `version` at the
 * API boundary (`W/"${user.version}"`); the domain never references HTTP.
 */
export class User {
  #props: UserProps

  private constructor(props: UserProps) {
    this.#props = props
  }

  /**
   * Command-input path — validates required invariants. Used when minting
   * a fresh aggregate in `SyncUserCommandHandler` before the first
   * `repo.create(user)` call.
   */
  static create(props: UserProps): User {
    if (props.firebaseUid.trim().length === 0) {
      throw new Error('firebaseUid is required')
    }
    if (props.email.trim().length === 0) {
      throw new Error('email is required')
    }
    return new User(props)
  }

  /** Storage path — no validation, trust our own persisted data. */
  static rehydrate(props: UserProps): User {
    return new User(props)
  }

  get id(): string {
    return this.#props.id
  }
  get version(): number {
    return this.#props.version
  }
  get firebaseUid(): string {
    return this.#props.firebaseUid
  }
  get email(): string {
    return this.#props.email
  }
  get role(): Role {
    return this.#props.role
  }
  get status(): UserStatus {
    return this.#props.status
  }
  get onboardingStage(): OnboardingStage {
    return this.#props.onboardingStage
  }
  get createdAt(): Date {
    return this.#props.createdAt
  }
  get updatedAt(): Date {
    return this.#props.updatedAt
  }
  get displayName(): string | undefined {
    return this.#props.displayName
  }
  get studentProfile(): StudentProfile | undefined {
    return this.#props.studentProfile
  }

  isStudent(): this is User & { readonly studentProfile: StudentProfile } {
    return this.#props.role === 'student' && this.#props.studentProfile !== undefined
  }

  isCoordinator(): boolean {
    return this.#props.role === 'coordinator'
  }

  isOwnedBy(platformUserId: string): boolean {
    return this.#props.id === platformUserId
  }

  // -------------------------------------------------------------------------
  // Mutations — void-returning, mutate `#props` in place. Each method
  // enforces its own invariants and reconciles derived state. Handlers
  // call these one-per-field based on which command patch keys were
  // present.
  // -------------------------------------------------------------------------

  /** Rename the user. Pass `undefined` to clear. No-op on same value. */
  changeDisplayName(displayName: string | undefined): void {
    if (this.#props.displayName === displayName) return
    this.#props = { ...this.#props, displayName }
  }

  /**
   * Domain invariant: `studentNumber` is fixed after first sync.
   * Same-value and `undefined` are no-ops; different value throws
   * `ValidationError` with `reason: 'immutable_field'`.
   */
  ensureStudentNumberMatches(candidate: string | undefined): void {
    this.#studentProfileOrThrow().ensureStudentNumberImmutable(candidate)
  }

  changeProgramCode(code: string): void {
    const current = this.#studentProfileOrThrow()
    if (current.programCode === code) return
    const next = current.withProgramCode(code).settleStatus(new Date())
    this.#replaceProfile(next)
  }

  changePhone(phone: string): void {
    const current = this.#studentProfileOrThrow()
    if (current.phone === phone) return
    const next = current.withPhone(phone).settleStatus(new Date())
    this.#replaceProfile(next)
  }

  clearPhone(): void {
    const current = this.#studentProfileOrThrow()
    if (current.phone === undefined) return
    const next = current.withPhone(undefined).settleStatus(new Date())
    this.#replaceProfile(next)
  }

  /**
   * Replace academic info. Preserves `confirmedAt` across rewrites — the
   * caller never supplies it, and the domain refuses to erase its own
   * stamp. `settleStatus` stamps `confirmedAt` on the first transition to
   * `profileStatus: complete`.
   */
  setAcademicInfo(info: AcademicInfo): void {
    const current = this.#studentProfileOrThrow()
    const preserved = current.academicInfo?.confirmedAt
    const incoming = preserved !== undefined ? info.withConfirmedAt(preserved) : info
    const next = current.withAcademicInfo(incoming).settleStatus(new Date())
    this.#replaceProfile(next)
  }

  /**
   * Drop academic info — returns the profile to incomplete state and
   * resyncs `onboardingStage`. Idempotent (no-op if already absent).
   * `confirmedAt` is also dropped since it's attached to the info.
   */
  clearAcademicInfo(): void {
    const current = this.#studentProfileOrThrow()
    if (current.academicInfo === undefined) return
    const next = current.withAcademicInfo(undefined).settleStatus(new Date())
    this.#replaceProfile(next)
  }

  /**
   * Private invariant guard. Throws `ForbiddenError` if the aggregate is
   * not in a student state (role=student + studentProfile present).
   * All student-scoped mutations funnel through this.
   */
  #studentProfileOrThrow(): StudentProfile {
    if (!this.isStudent()) {
      throw new ForbiddenError('Cannot edit a non-student user record')
    }
    return this.#props.studentProfile as StudentProfile
  }

  /** Swap the embedded StudentProfile and sync `onboardingStage`. */
  #replaceProfile(profile: StudentProfile): void {
    this.#props = {
      ...this.#props,
      studentProfile: profile,
      onboardingStage: profile.isComplete() ? 'profile_complete' : 'profile_pending',
    }
  }
}

export const USER_SCHEMA_VERSION = 1 as const
