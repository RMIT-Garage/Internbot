import type { Internship } from '../../../domain/entities/internship'
import type {
  InternshipAttachment,
  InternshipListFilter,
  InternshipListPage,
} from '../../read-models/internship'

/**
 * Read-side port for the `internships` aggregate. Bypasses the write-side
 * repository and the UnitOfWork transaction entirely — query services are
 * standalone singletons injected directly into query handlers, so list
 * traffic does not pay the per-read transactional overhead and does not
 * load aggregate sub-entities it doesn't need. Read-side `findById` returns
 * the aggregate **without** eager-loading sub-entities; if a query needs
 * attachments it calls `listAttachments` explicitly. Soft-deleted
 * attachments are hidden from API responses.
 *
 * `findByUserIdAndOpportunityId` lives on the write-side
 * `InternshipRepository` (used by create-internship as a txn-bound
 * uniqueness guard); no read endpoint exposes it.
 *
 * Input/output models live in `application/read-models/internship`.
 */
export interface InternshipQueryService {
  findById(id: string): Promise<Internship | null>
  list(filter: InternshipListFilter): Promise<InternshipListPage>
  listByUserId(userId: string): Promise<readonly Internship[]>
  /** Returns attachments where `deletedAt` is unset. */
  listAttachments(internshipId: string): Promise<readonly InternshipAttachment[]>
  /** Returns null if the attachment is soft-deleted or missing. */
  findAttachmentById(
    internshipId: string,
    attachmentId: string
  ): Promise<InternshipAttachment | null>
}
