import type { Notification } from '../entities/notification'

/**
 * Write-side port over the `notifications` aggregate. Pure-DDD/CQRS surface
 * (`findById` / `save` / `delete`) plus the narrow `listUnreadByUserId`
 * read used by the bulk mark-all-read command for in-transaction load.
 *
 * `save` is an upsert: `aggregate.version === 0` → first-write; else
 * optimistic-lock update with a per-doc re-read for the version check.
 *
 * `applyMarkReadBatch` is the write-only fan-out path used by the bulk
 * mark-all-read command. The caller pre-loads via `listUnreadByUserId`
 * (one txn read), then we issue `txn.update` per doc with no re-reads —
 * Firestore's reads-before-writes invariant rules out the per-doc re-read
 * once any write has been queued in the same txn. Concurrent writers are
 * still detected: Firestore retries the txn if the listed query's
 * snapshot diverges before commit.
 *
 * Read-side `list` and `countUnreadByUserId` (used by GET endpoints) live
 * on `NotificationQueryService`.
 */
export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>
  save(notification: Notification): Promise<void>
  delete(id: string): Promise<void>
  listUnreadByUserId(userId: string): Promise<readonly Notification[]>
  applyMarkReadBatch(notifications: readonly Notification[]): Promise<void>
}
