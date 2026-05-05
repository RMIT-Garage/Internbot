import type { RequestActor } from '../actor'
import type { UnitOfWork, UnitOfWorkContext } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { OpportunityType, WorkMode } from '../../domain/value-objects/opportunity-enums'
import { Opportunity } from '../../domain/entities/opportunity'
import { ConflictError, ForbiddenError, ValidationError } from '../../domain/errors'

export interface CreateOpportunityCommand {
  actor: RequestActor
  payload: {
    semesterId: string | undefined
    type: OpportunityType | undefined
    employerName: string
    jobTitle: string
    descriptionText: string
    workMode: WorkMode | undefined
    location: string | undefined
    sourceUrl: string | undefined
  }
}

export interface CreateOpportunityResult {
  id: string
}

export class CreateOpportunityCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: CreateOpportunityCommand): Promise<CreateOpportunityResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    const newOpportunityId = this.idGenerator.next()
    const now = new Date()

    return this.uow.execute(async (ctx) => {
      const semesterId =
        platformUser.role === 'student'
          ? await selectedSemesterIdForStudent(ctx, platformUser.id)
          : requiredCoordinatorSemesterId(cmd.payload.semesterId)
      const type =
        platformUser.role === 'student' ? 'custom' : requiredCoordinatorType(cmd.payload.type)

      const semester = await ctx.semesters.findById(semesterId)
      if (!semester || semester.status !== 'active') {
        throw new ConflictError('Referenced semester is not active', 'semester_not_active')
      }

      const opportunity = Opportunity.create({
        id: newOpportunityId,
        version: 0,
        semesterId,
        type,
        employerName: cmd.payload.employerName,
        jobTitle: cmd.payload.jobTitle,
        descriptionText: cmd.payload.descriptionText,
        workMode: cmd.payload.workMode,
        location: cmd.payload.location,
        sourceUrl: cmd.payload.sourceUrl,
        status: platformUser.role === 'student' ? 'pending_verification' : 'draft',
        createdByUserId: platformUser.role === 'coordinator' ? platformUser.id : undefined,
        submittedByUserId: platformUser.role === 'student' ? platformUser.id : undefined,
        verifiedByUserId: undefined,
        verifiedAt: undefined,
        createdAt: now,
        updatedAt: now,
      })

      await ctx.opportunities.create(opportunity)
      return { id: newOpportunityId }
    })
  }
}

function requiredCoordinatorSemesterId(semesterId: string | undefined): string {
  if (semesterId !== undefined && semesterId.trim().length > 0) return semesterId
  throw new ValidationError('semesterId is required', 'missing_required_field', [
    { field: 'semesterId', code: 'required', message: 'semesterId is required for coordinators' },
  ])
}

function requiredCoordinatorType(type: OpportunityType | undefined): OpportunityType {
  if (type !== undefined) return type
  throw new ValidationError('type is required', 'missing_required_field', [
    { field: 'type', code: 'required', message: 'type is required for coordinators' },
  ])
}

async function selectedSemesterIdForStudent(
  ctx: UnitOfWorkContext,
  userId: string
): Promise<string> {
  const user = await ctx.users.findById(userId)
  const semesterId = user?.studentProfile?.semesterId
  if (!user || user.role !== 'student' || semesterId === undefined) {
    throw new ConflictError('Student has no selected semester', 'student_has_no_selected_semester')
  }
  return semesterId
}
