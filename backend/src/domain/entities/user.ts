import type { OnboardingStage, Role, UserStatus } from '../value-objects/user-enums'
import type { AcademicInfo } from '../value-objects/academic-info'
import type { StudentProfile } from '../value-objects/student-profile'
import type { UserIdentity } from '../value-objects/user-identity'
import { ConflictError, ForbiddenError } from '../errors'

/**
 * UserProps — single-object constructor bag for the aggregate.
 */
export interface UserProps {
  readonly id: string
  readonly version: number
  readonly email: string
  readonly role: Role
  readonly status: UserStatus
  readonly onboardingStage: OnboardingStage
  readonly identity: UserIdentity
  readonly createdAt: Date
  readonly updatedAt: Date
  readonly displayName: string | undefined
  readonly studentProfile: StudentProfile | undefined
}

/**
 * User — root of the user aggregate.
 *
 * Identity by `id` (Firestore auto-id). The IdP-issued `identity` value
 * object is a permanent, immutable field — every aggregate carries it,
 * registered or rehydrated. Persisted denormalised on `users/{id}` (source
 * of truth) plus a slim `userIdentities/{key} → { userId }` sentinel that
 * enforces uniqueness via `txn.create exists=false`.
 *
 * **Mutable aggregate** (Vernon-style DDD): behaviour methods
 * (`changePhone`, `setAcademicInfo`, ...) return `void` and mutate the
 * aggregate's internal state via a private `#props` field. State
 * transitions (e.g. `profileStatus`, `onboardingStage`, `confirmedAt`
 * stamping) happen inside the mutation — handlers don't orchestrate
 * derived state. Identity itself is never mutated.
 *
 * Two factories:
 *   - `create(props)` — command-handler input path for new aggregates.
 *     Validates required invariants. The repository persists user + identity
 *     atomically inside `create(user)`.
 *   - `rehydrate(props)` — storage path. No validation (trust our own
 *     data); the Firestore mapper calls this.
 *
 * `version` is the domain-level concurrency token — an app-managed
 * monotonic integer persisted on the doc. **Never incremented
 * client-side**; the repository reads the stored value inside the
 * transaction, compares against `user.version` for the If-Match check,
 * and writes `stored + 1` on success. New aggregates start at `0`; the
 * first save persists `1`. The HTTP ETag is derived from `version` at the
 * API boundary (`W/"${user.version}"`); the domain never references HTTP.
 */
export class User {
  #props: UserProps

  private constructor(props: UserProps) {
    this.#props = props
  }

  /**
   * Command-input path for *new* aggregates. Validates required invariants.
   * The caller is responsible for minting the id (via `IdGenerator`) and
   * constructing the `identity` VO before calling.
   */
  static create(props: UserProps): User {
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
  get identity(): UserIdentity {
    return this.#props.identity
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
   * Enrol the student in a semester. Per WORKFLOW-API-SPEC.md §7.6 the
   * profile must be `complete` before a semester may be selected — the
   * domain enforces this here so the handler doesn't have to. Window /
   * semester-status checks live on the handler (they need the semester
   * aggregate which the user doesn't carry).
   *
   * `semesterSelectedAt` is preserved across re-selection (set on the
   * first call only) — the value object owns that invariant.
   */
  selectSemester(semesterId: string, now: Date): void {
    const current = this.#studentProfileOrThrow()
    if (!current.isComplete()) {
      throw new ConflictError(
        'Profile must be complete before selecting a semester',
        'profile_incomplete'
      )
    }
    const next = current.withSemester(semesterId, now)
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
