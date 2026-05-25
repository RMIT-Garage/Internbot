import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import { Internship } from '../../domain/entities/internship'
import { Notification } from '../../domain/entities/notification'
import { ConflictError, NotFoundError } from '../../domain/errors'

export interface CreateInternshipCommand {
  actor: RequestActor
  payload: {
    opportunityId: string
  }
}

export interface CreateInternshipResult {
  id: string
}

export class CreateInternshipCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateInternshipCommand): Promise<CreateInternshipResult> {
    const platformUser = this.authz.requireRole(cmd.actor, 'student')

    const internshipId = this.idGenerator.next()
    const applyActivityId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      // Pre-check duplicate-application inside the txn for an explicit
      // domain error; the sentinel-doc create in `save` is the atomic guard
      // that closes the race window.
      const existing = await ctx.internships.findByUserIdAndOpportunityId(
        platformUser.id,
        cmd.payload.opportunityId
      )
      if (existing) {
        throw new ConflictError(
          'Student already applied to this opportunity',
          'duplicate_application'
        )
      }

      const student = await ctx.users.findById(platformUser.id)
      const semesterId = student?.studentProfile?.semesterId
      if (!student || !student.isStudent() || semesterId === undefined) {
        throw new ConflictError(
          'Student has no selected semester',
          'student_has_no_selected_semester'
        )
      }

      const opportunity = await ctx.opportunities.findById(cmd.payload.opportunityId)
      if (!opportunity) throw new NotFoundError('Opportunity', cmd.payload.opportunityId)
      if (opportunity.status !== 'published') {
        throw new ConflictError('Opportunity is not published', 'opportunity_not_published')
      }
      if (opportunity.semesterId !== semesterId) {
        throw new ConflictError(
          "Opportunity does not belong to the student's selected semester",
          'opportunity_semester_mismatch'
        )
      }

      // All cross-aggregate reads finish before any write — Firestore
      // transactions require reads-before-writes. Coordinators are loaded
      // inside the txn so the recipient set is strongly consistent with
      // the new internship doc.
      const coordinators = await ctx.users.listCoordinators()

      const internship = Internship.createApplication({
        id: internshipId,
        userId: platformUser.id,
        opportunityId: opportunity.id,
        semesterId: opportunity.semesterId,
        activityId: applyActivityId,
        now,
      })
      await ctx.internships.save(internship)

      for (const coordinator of coordinators) {
        await ctx.notifications.save(
          Notification.forNewApplication({
            id: this.idGenerator.next(),
            userId: coordinator.id,
            internshipId,
            opportunityId: opportunity.id,
            now,
          })
        )
      }

      return { id: internshipId }
    })
  }
}
