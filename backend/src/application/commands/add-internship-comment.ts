import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { IdGenerator } from '../ports/id-generator'
import type { InternshipActivityResult } from '../models/internship'
import { ForbiddenError, NotFoundError } from '../../domain/errors'

export interface AddInternshipCommentCommand {
  actor: RequestActor
  internshipId: string
  text: string
}

export class AddInternshipCommentCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly idGenerator: IdGenerator
  ) {}

  async handle(cmd: AddInternshipCommentCommand): Promise<InternshipActivityResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const internship = await ctx.internships.findById(cmd.internshipId)
      if (!internship) throw new NotFoundError('Internship', cmd.internshipId)
      if (platformUser.role === 'student' && internship.userId !== platformUser.id) {
        throw new ForbiddenError(
          'Students may only comment on their own internships',
          'student_not_owner'
        )
      }

      const activity = internship.comment(
        this.idGenerator.next(),
        platformUser.id,
        platformUser.role,
        cmd.text,
        new Date()
      )
      await ctx.internships.addActivity(internship.id, activity)
      return { activity }
    })
  }
}
