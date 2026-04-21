import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { PlatformClaimsService } from '../ports/platform-claims-service'
import { ValidationError } from '../../domain/errors'
import { StudentProfile } from '../../domain/value-objects/student-profile'
import { User } from '../../domain/entities/user'

/**
 * POST /api/v1/auth/sync command — verifies the Firebase identity and returns
 * the platform user id, creating the `users/{id}` document on first call.
 *
 * Per WORKFLOW-API-SPEC.md §7.1:
 *   - First call: required `studentNumber`, creates user with `role: student`,
 *     sets Firebase custom claims `{ platformUserId, role }`, returns 201
 *   - Subsequent calls: lookup by firebaseUid, update mutable fields
 *     (displayName), re-affirm claims (idempotent), return 200
 *
 * Strict CQRS: returns only `{ id, created }`. The route dispatches a
 * follow-up `GetUserQueryHandler` to hydrate the response body.
 */
export interface SyncUserCommand {
  actor: RequestActor
  studentNumber: string | undefined
  displayName: string | undefined
}

export interface SyncUserResult {
  id: string
  created: boolean
}

export class SyncUserCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly platformClaims: PlatformClaimsService
  ) {}

  async handle(cmd: SyncUserCommand): Promise<SyncUserResult> {
    const outcome = await this.uow.execute(async (uow) => {
      const existing = await uow.users.findByFirebaseUid(cmd.actor.firebaseUid)

      if (existing) {
        if (cmd.displayName !== undefined && cmd.displayName !== existing.displayName) {
          existing.changeDisplayName(cmd.displayName)
          await uow.users.save(existing)
        }
        return { id: existing.id, role: existing.role, created: false }
      }

      if (!cmd.studentNumber) {
        throw new ValidationError(
          'studentNumber is required on first sync',
          'missing_required_field',
          [
            {
              field: 'studentNumber',
              code: 'required',
              message: 'studentNumber is required on first POST /auth/sync',
            },
          ]
        )
      }

      const user = User.create({
        id: '',
        version: 0,
        firebaseUid: cmd.actor.firebaseUid,
        email: cmd.actor.email ?? '',
        role: 'student',
        status: 'active',
        onboardingStage: 'profile_pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        displayName: cmd.displayName,
        studentProfile: newIncompleteProfile(cmd.studentNumber),
      })
      const { id } = await uow.users.create(user)
      return { id, role: 'student' as const, created: true }
    })

    // After the transaction commits, set Firebase custom claims so the
    // next ID token the caller mints carries the platform identity.
    // Idempotent — re-setting the same values is harmless.
    await this.platformClaims.set(cmd.actor.firebaseUid, {
      platformUserId: outcome.id,
      role: outcome.role,
    })

    return { id: outcome.id, created: outcome.created }
  }
}

function newIncompleteProfile(studentNumber: string): StudentProfile {
  return StudentProfile.create({
    studentNumber,
    profileStatus: 'incomplete',
    programCode: undefined,
    phone: undefined,
    academicInfo: undefined,
    semesterId: undefined,
    semesterSelectedAt: undefined,
  })
}
