import type { Opportunity } from '../entities/opportunity'
import type { OpportunityStatus, OpportunityType } from '../value-objects/opportunity-enums'

export interface OpportunityAttachment {
  readonly id: string
  readonly fileName: string | undefined
  readonly contentType: string | undefined
  readonly uploadedAt: Date
}

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
  create(opportunity: Opportunity): Promise<void>
  save(opportunity: Opportunity): Promise<void>
}
