import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { AuthorizationService } from '../ports/authorization-service'
import type { InternshipActivity } from '../../domain/value-objects/internship-activity'
import { NotFoundError } from '../../domain/errors'

export interface InternshipActivityResult {
  activity: InternshipActivity
}

export interface AddInternshipCommentCommand {
  actor: RequestActor
  internshipId: string
  text: string
}

export class AddInternshipCommentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: AddInternshipCommentCommand): Promise<InternshipActivityResult> {
    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      const platformUser = this.authz.requireSelfOrRole(
        cmd.actor,
        internship.userId,
        ['coordinator'],
        'student_not_owner'
      )

      const activity = internship.comment(
        this.idGenerator.next(),
        platformUser.id,
        platformUser.role,
        cmd.text,
        new Date()
      )
      await ctx.internships.save(internship)
      return { activity }
    })
  }
}
