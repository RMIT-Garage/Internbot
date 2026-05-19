import type { Internship } from '../entities/internship'

/**
 * Write-side port over the `internships` aggregate. Pure-DDD/CQRS surface
 * (`findById` / `save` / `delete`) plus the narrow
 * `findByUserIdAndOpportunityId` read used by `CreateInternshipCommand` to
 * enforce duplicate-application uniqueness inside the same Firestore
 * transaction (no separate sentinel doc).
 *
 *   - `findById` — eager-loads the aggregate with its sub-entities so
 *     invariant checks are self-contained.
 *   - `save`     — upsert: when `aggregate.version === 0` the impl performs
 *     the first-write path; otherwise it enforces optimistic concurrency
 *     against the persisted version.
 *   - `delete`   — hard-delete escape hatch for ops/migrations. Routine
 *     "delete attachment" flows are soft-delete via the aggregate root.
 *   - `findByUserIdAndOpportunityId` — txn-bound uniqueness guard for
 *     create-internship; not exposed by any read endpoint.
 *
 * Read-side queries (list, listByUserId, listAttachments,
 * findAttachmentById) live on `InternshipQueryService`.
 */
export interface InternshipRepository {
  findById(id: string): Promise<Internship | null>
  save(internship: Internship): Promise<void>
  delete(id: string): Promise<void>
  findByUserIdAndOpportunityId(userId: string, opportunityId: string): Promise<Internship | null>
}
