import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import { ForbiddenError } from '../../domain/errors'

export interface MarkAllNotificationsReadCommand {
  actor: RequestActor
}

export interface MarkAllNotificationsReadResult {
  markedReadCount: number
}

export class MarkAllNotificationsReadCommandHandler {
  constructor(private readonly uow: UnitOfWork) {}

  async handle(cmd: MarkAllNotificationsReadCommand): Promise<MarkAllNotificationsReadResult> {
    const platformUser = cmd.actor.platformUser
    if (!platformUser) {
      throw new ForbiddenError('Caller has no platform user record.', 'no_platform_user')
    }

    return this.uow.execute(async (ctx) => {
      const markedReadCount = await ctx.notifications.markUnreadAsReadByUserId(
        platformUser.id,
        new Date()
      )
      return { markedReadCount }
    })
  }
}
