import type { Opportunity } from '../entities/opportunity'

/**
 * Write-side port over the `opportunities` aggregate. Pure-DDD/CQRS surface —
 * exactly three methods:
 *   - `findById` — eager-loads the aggregate with its `attachments`
 *     subcollection so invariant checks like `removeAttachment` are
 *     self-contained.
 *   - `save`     — upsert: when `aggregate.version === 0` the impl performs
 *     the first-write path; otherwise it enforces optimistic concurrency.
 *     Drains `pendingEvents` (`OpportunityTransitioned`,
 *     `OpportunityVerified`, `OpportunityAttachmentAdded`,
 *     `OpportunityAttachmentRemoved`) and writes each event's
 *     persistence atomically.
 *   - `delete`   — hard-delete escape hatch for ops/migrations. Routine
 *     "delete attachment" flows hard-delete via the aggregate root and
 *     enqueue an `attachmentPurgeQueue` outbox row in the same txn.
 *
 * Read-side queries (list, countApplications, listAttachments,
 * findAttachmentById) live on `OpportunityQueryService`.
 */
export interface OpportunityRepository {
  findById(id: string): Promise<Opportunity | null>
  save(opportunity: Opportunity): Promise<void>
  delete(id: string): Promise<void>
}
