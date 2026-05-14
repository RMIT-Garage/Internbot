import type { PlatformUser } from '../../application/actor'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import type { UserQueryService } from '../../application/ports/queries/user-query-service'
import { User } from '../../domain/entities/user'
import { UserIdentity } from '../../domain/value-objects/user-identity'
import { StudentProfile } from '../../domain/value-objects/student-profile'
import { parseStudentNumberFromEmail } from '../../domain/value-objects/student-number'

/**
 * Edge-identity hydration with just-in-time student bootstrap.
 *
 * Pattern B: every authenticated request resolves platform identity at the
 * edge from the IdP-attested token alone — no client handshake. On first
 * request from a freshly-signed-up student, this hydrator transactionally
 * creates the `users/{id}` aggregate + the `userIdentities/{provider}__{uid}`
 * sentinel, then returns the resulting `PlatformUser`.
 *
 * Identity lookup happens against the read-side `UserQueryService` (no
 * transactional overhead on the steady-state happy path); only the
 * one-off JIT-create branch enters a write transaction. Uniqueness is
 * still enforced atomically inside `users.save()` against the
 * `userIdentities/{key}` sentinel — this lookup is not a TOCTOU guard.
 *
 * Coordinators are admin-provisioned (their `users/{id}` doc + Firebase Auth
 * user are created together by an admin endpoint) so they reach this hydrator
 * already-hydrated and never trigger the JIT branch. The student-email regex
 * gate (`enforceStudentEmail` blocking function) ensures only student-shape
 * emails ever reach this code path on a self-serve sign-up; the verified-
 * email gate below ensures the caller actually owns that mailbox.
 */
export interface HydrateInput {
  firebaseUid: string
  email: string | undefined
  emailVerified: boolean
}

export type HydratePlatformUser = (input: HydrateInput) => Promise<PlatformUser | null>

export function createPlatformUserHydrator(
  userQueries: UserQueryService,
  uow: UnitOfWork,
  idGenerator: IdGenerator
): HydratePlatformUser {
  return async function hydratePlatformUser({
    firebaseUid,
    email,
    emailVerified,
  }: HydrateInput): Promise<PlatformUser | null> {
    const lookup = { provider: 'firebase' as const, providerUserId: firebaseUid }
    const existing = await userQueries.findByIdentity(lookup)
    if (existing) {
      return { id: existing.id, role: existing.role }
    }

    // JIT student bootstrap. Coordinators never reach here — they're
    // admin-provisioned (Firebase Auth user + users/{id} doc atomically)
    // so `findByIdentity` already returned them above. If we got here,
    // the caller is a brand-new student-shape email.

    // Email-verification gate. Refuse to mint a `users/{id}` doc for an
    // email the IdP has not confirmed the caller controls — otherwise an
    // attacker who signed up as `s9999999@student.rmit.edu.au` (a real
    // student's address) could squat that student number before the
    // legitimate owner ever clicks their verification link.
    if (!emailVerified) {
      return null
    }

    const studentNumber = parseStudentNumberFromEmail(email)
    if (!studentNumber) {
      // Email is not RMIT-student-shaped. With the `enforceStudentEmail`
      // blocking function in place this is unreachable; if we get here
      // auth provider config has drifted (blocking function disabled,
      // or coordinator hit the JIT path without a pre-provisioned doc).
      // Surface as null so the middleware can refuse the request — better
      // than minting a corrupt user record.
      return null
    }

    const newId = idGenerator.next()
    const now = new Date()
    const user = User.create({
      id: newId,
      version: 0,
      email: email ?? '',
      role: 'student',
      status: 'active',
      onboardingStage: 'profile_pending',
      identity: UserIdentity.create({ ...lookup, emailSnapshot: email }),
      createdAt: now,
      updatedAt: now,
      displayName: undefined,
      studentProfile: StudentProfile.create({
        studentNumber,
        profileStatus: 'incomplete',
        programCode: undefined,
        phone: undefined,
        academicInfo: undefined,
        semesterId: undefined,
        semesterSelectedAt: undefined,
      }),
    })

    // First-write path: `version === 0` makes save() perform the
    // transactional sentinel insert. Two concurrent first-requests from
    // the same uid resolve to the same `users/{id}` because the loser
    // hits the sentinel-exists guard and rolls back.
    await uow.execute(async (ctx) => {
      await ctx.users.save(user)
    })
    return { id: newId, role: 'student' }
  }
}
