import type { Opportunity } from '../../../domain/entities/opportunity'
import type {
  OpportunityAttachment,
  OpportunityListFilter,
  OpportunityListPage,
} from '../../read-models/opportunity'

/**
 * Read-side port for the `opportunities` aggregate. Standalone singleton —
 * not on the UnitOfWork.
 *
 * Input/output models live in `application/read-models/opportunity`.
 */
export interface OpportunityQueryService {
  findById(id: string): Promise<Opportunity | null>
  list(filter: OpportunityListFilter): Promise<OpportunityListPage>
  countApplications(opportunityId: string): Promise<number>
  listAttachments(opportunityId: string): Promise<readonly OpportunityAttachment[]>
  findAttachmentById(
    opportunityId: string,
    attachmentId: string
  ): Promise<OpportunityAttachment | null>
}
