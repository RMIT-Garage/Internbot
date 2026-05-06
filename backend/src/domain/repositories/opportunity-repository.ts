import type { Opportunity } from '../entities/opportunity'
import type { Attachment } from '../value-objects/attachment'
import type { OpportunityStatus, OpportunityType } from '../value-objects/opportunity-enums'

export type OpportunityAttachment = Attachment

export interface OpportunityListCursor {
  readonly sortField: 'createdAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly lastValue: Date | null
  readonly lastDocId: string
}

export interface OpportunityListFilter {
  readonly semesterId: string | undefined
  readonly status: readonly OpportunityStatus[] | undefined
  readonly type: OpportunityType | undefined
  readonly limit: number
  readonly sortField: 'createdAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly cursor: OpportunityListCursor | undefined
}

export interface OpportunityListPage {
  readonly items: readonly Opportunity[]
  readonly nextCursor: OpportunityListCursor | null
}

export interface OpportunityRepository {
  findById(id: string): Promise<Opportunity | null>
  list(filter: OpportunityListFilter): Promise<OpportunityListPage>
  countApplications(opportunityId: string): Promise<number>
  listAttachments(opportunityId: string): Promise<readonly OpportunityAttachment[]>
  findAttachmentById(
    opportunityId: string,
    attachmentId: string
  ): Promise<OpportunityAttachment | null>
  saveAttachmentFromStorage(opportunityId: string, attachment: Attachment): Promise<boolean>
  create(opportunity: Opportunity): Promise<void>
  save(opportunity: Opportunity): Promise<void>
}
