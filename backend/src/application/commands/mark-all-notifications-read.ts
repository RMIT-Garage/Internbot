import type { RequestActor } from '../actor'
import type { UnitOfWork } from '../ports/unit-of-work'
import type { AuthorizationService } from '../ports/authorization-service'

export interface MarkAllNotificationsReadCommand {
  actor: RequestActor
}

export interface MarkAllNotificationsReadResult {
  markedReadCount: number
}

/**
 * Loads the caller's unread notifications inside the transaction (via the
 * write-side `NotificationRepository.listUnreadByUserId`) so the read +
 * mutation set commit atomically. Firestore caps a transaction at 500
 * reads/writes — 200 docs per pass keeps headroom for the per-doc save.
 *
 * Each iteration re-queries the unread set; previously-marked docs no
 * longer match the `readAt == null` filter, so we naturally drain the
 * backlog without tracking a cursor.
 */
const TXN_BATCH_SIZE = 200

export class MarkAllNotificationsReadCommandHandler {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly authz: AuthorizationService
  ) {}

  async handle(cmd: MarkAllNotificationsReadCommand): Promise<MarkAllNotificationsReadResult> {
    const platformUser = this.authz.requirePlatformUser(cmd.actor)

    let markedReadCount = 0
    const now = new Date()

    while (true) {
      const count = await this.uow.execute(async (ctx) => {
        // Reads-before-writes: load the unread set first (one txn read),
        // then fan out via the write-only `applyMarkReadBatch` path so we
        // don't re-read per doc after writes start.
        const unread = await ctx.notifications.listUnreadByUserId(platformUser.id)
        const batch = unread.slice(0, TXN_BATCH_SIZE)
        for (const notification of batch) {
          notification.markRead(now)
        }
        await ctx.notifications.applyMarkReadBatch(batch)
        return batch.length
      })

      markedReadCount += count
      if (count < TXN_BATCH_SIZE) break
    }

    return { markedReadCount }
  }
}
