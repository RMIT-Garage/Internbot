import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import { Internship } from '../../domain/entities/internship'
import { Notification } from '../../domain/entities/notification'
import { ConflictError, ForbiddenError, NotFoundError } from '../../domain/errors'

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
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateInternshipCommand): Promise<CreateInternshipResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }
    if (platformUser.role !== 'student') {
      throw new ForbiddenError('Only students may create internships', 'role_restricted_action')
    }

    const internshipId = this.idGenerator.next()
    const applyActivityId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
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

      const existing = await ctx.internships.findByUserIdAndOpportunityId(
        platformUser.id,
        opportunity.id
      )
      if (existing) {
        throw new ConflictError(
          'Student already applied to this opportunity',
          'duplicate_application'
        )
      }

      const coordinators = await ctx.users.listCoordinators()
      const internship = Internship.createApplication({
        id: internshipId,
        userId: platformUser.id,
        opportunityId: opportunity.id,
        activityId: applyActivityId,
        now,
      })
      await ctx.internships.create(internship)

      for (const coordinator of coordinators) {
        await ctx.notifications.create(
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
