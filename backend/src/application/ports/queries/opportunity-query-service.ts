import type { Opportunity } from '../../../domain/entities/opportunity'
import type {
  OpportunityAttachment,
  OpportunityListFilter,
  OpportunityListPage,
} from '../../read-models/opportunity'

/**
 * Read-side port for the `opportunities` aggregate. Standalone singleton —
 * not on the UnitOfWork. Hides soft-deleted attachments from API responses;
 * the write-side repository keeps them for invariant checks.
 *
 * Input/output models live in `application/read-models/opportunity`.
 */
export interface OpportunityQueryService {
  findById(id: string): Promise<Opportunity | null>
  list(filter: OpportunityListFilter): Promise<OpportunityListPage>
  countApplications(opportunityId: string): Promise<number>
  /** Returns attachments where `deletedAt` is unset. */
  listAttachments(opportunityId: string): Promise<readonly OpportunityAttachment[]>
  /** Returns null if the attachment is soft-deleted or missing. */
  findAttachmentById(
    opportunityId: string,
    attachmentId: string
  ): Promise<OpportunityAttachment | null>
}
