import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import type { SemesterStatus } from '../../domain/value-objects/semester-enums'
import { Semester } from '../../domain/entities/semester'

/**
 * POST /api/v1/semesters command.
 *
 * Per WORKFLOW-API-SPEC.md §7.5:
 *   - Coordinator-only.
 *   - Natural-key uniqueness on `(semesterCode, courseCode)` enforced inside
 *     the transaction by `SemesterRepository.create` — concurrent calls with
 *     the same key produce exactly one document; the loser gets
 *     `ConflictError(reason: natural_key_exists)` translated to HTTP 409.
 *
 * Strict CQRS: returns only `{ id }`. The route dispatches `GetSemester`
 * for the response body.
 */
export interface CreateSemesterCommand {
  actor: RequestActor
  payload: {
    semesterCode: string
    courseCode: string
    displayName: string
    status: SemesterStatus
    enrolmentOpenAt: Date | undefined
    enrolmentCloseAt: Date | undefined
  }
}

export interface CreateSemesterResult {
  id: string
}

export class CreateSemesterCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateSemesterCommand): Promise<CreateSemesterResult> {
    this.authz.requireRole(cmd.actor, 'coordinator')

    const newSemesterId = this.idGenerator.next()
    const now = new Date()
    const semester = Semester.create({
      id: newSemesterId,
      version: 0,
      semesterCode: cmd.payload.semesterCode,
      courseCode: cmd.payload.courseCode,
      displayName: cmd.payload.displayName,
      status: cmd.payload.status,
      enrolmentOpenAt: cmd.payload.enrolmentOpenAt,
      enrolmentCloseAt: cmd.payload.enrolmentCloseAt,
      createdAt: now,
      updatedAt: now,
    })

    return this.uow.execute(async (ctx) => {
      await ctx.semesters.save(semester)
      return { id: newSemesterId }
    })
  }
}
