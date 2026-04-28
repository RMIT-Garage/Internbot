import type { PlatformUser } from '../../application/actor'
import type { UnitOfWork } from '../../application/ports/unit-of-work'
import type { IdGenerator } from '../../application/ports/id-generator'
import { User } from '../../domain/entities/user'
import { UserIdentity } from '../../domain/value-objects/user-identity'
import { StudentProfile } from '../../domain/value-objects/student-profile'
import { parseStudentNumberFromEmail } from '../../domain/services/student-number-derivation'

/**
 * Edge-identity hydration with just-in-time student bootstrap.
 *
 * Pattern B: every authenticated request resolves platform identity at the
 * edge from the IdP-attested token alone — no client handshake. On first
 * request from a freshly-signed-up student, this hydrator transactionally
 * creates the `users/{id}` aggregate + the `userIdentities/{provider}__{uid}`
 * sentinel, then returns the resulting `PlatformUser`.
 *
 * Why JIT here (not in a `/me` route or a dedicated bootstrap endpoint):
 *   - Removes the client-side handshake step entirely; the IdP token is the
 *     only thing the frontend ever sends. Any authenticated endpoint "just
 *     works" on first call.
 *   - Bootstrap happens inside the same transaction that does the read, so
 *     two concurrent first-requests from the same uid resolve to the same
 *     `users/{id}` (the `userIdentities` sentinel is the uniqueness lock).
 *   - When an API gateway is introduced later, the gateway hands the platform
 *     identity in via a signed internal passport — this whole hydrator
 *     becomes a no-op pass-through.
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
  uow: UnitOfWork,
  idGenerator: IdGenerator
): HydratePlatformUser {
  return async function hydratePlatformUser({
    firebaseUid,
    email,
    emailVerified,
  }: HydrateInput): Promise<PlatformUser | null> {
    return uow.execute(async (ctx) => {
      const lookup = { provider: 'firebase' as const, providerUserId: firebaseUid }
      const existing = await ctx.users.findByIdentity(lookup)
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
      //
      // We deliberately don't pair this with a `beforeUserSignedIn`
      // blocking function: that would reject the implicit sign-in inside
      // `createUserWithEmailAndPassword`, leaving the frontend with no
      // authenticated session from which to call `sendEmailVerification`.
      // See `backend/src/index.ts` for the full rationale.
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
      await ctx.users.create(user)
      return { id: newId, role: 'student' }
    })
  }
}
