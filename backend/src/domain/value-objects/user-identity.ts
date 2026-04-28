import { ValidationError } from '../errors'

/**
 * UserIdentity — value object for the IdP-issued mapping that lets the
 * platform recognise a caller across logins. Distinct from the `User`
 * aggregate's `id`: identity is the **inverted index** that resolves a
 * Firebase uid to a platform user; nothing in the domain ever uses
 * `providerUserId` as a foreign key.
 *
 * Persisted in two places, atomically:
 *   1. Denormalised onto `users/{id}.identity` — source of truth, read on
 *      every `findById` so the User aggregate always carries it.
 *   2. As a slim `userIdentities/{provider}__{providerUserId} → { userId }`
 *      sentinel — uniqueness is enforced by `txn.create exists=false` on
 *      the deterministic id.
 *
 * Immutable: identity never changes for the lifetime of a User. New IdP
 * link/unlink operations would mint a different aggregate or evolve the
 * schema, never mutate this VO.
 */
export type IdentityProvider = 'firebase'

export interface UserIdentityProps {
  readonly provider: IdentityProvider
  readonly providerUserId: string
  readonly emailSnapshot: string | undefined
}

/**
 * Lookup shape — accepted by `UserRepository.findByIdentity`. A subset of
 * the VO's props (no `emailSnapshot`) so callers can resolve a User from a
 * Firebase token alone.
 */
export interface UserIdentityLookup {
  readonly provider: IdentityProvider
  readonly providerUserId: string
}

export class UserIdentity {
  #props: Readonly<UserIdentityProps>

  private constructor(props: UserIdentityProps) {
    this.#props = props
  }

  /** Command-input path — validates required invariants. */
  static create(props: UserIdentityProps): UserIdentity {
    if (props.providerUserId.trim().length === 0) {
      throw new ValidationError('providerUserId is required', 'invalid_identity')
    }
    return new UserIdentity(props)
  }

  /** Storage path — no validation, trust persisted data. */
  static rehydrate(props: UserIdentityProps): UserIdentity {
    return new UserIdentity(props)
  }

  get provider(): IdentityProvider {
    return this.#props.provider
  }
  get providerUserId(): string {
    return this.#props.providerUserId
  }
  get emailSnapshot(): string | undefined {
    return this.#props.emailSnapshot
  }

  /**
   * Deterministic key used as the Firestore doc id of the uniqueness
   * sentinel. URL-encoded so providers that allow non-alphanumeric chars
   * in their uid space don't collide on the `__` separator.
   */
  toLookupKey(): string {
    return `${this.#props.provider}__${encodeURIComponent(this.#props.providerUserId)}`
  }

  equals(other: UserIdentity): boolean {
    return (
      this.#props.provider === other.#props.provider &&
      this.#props.providerUserId === other.#props.providerUserId
    )
  }
}
