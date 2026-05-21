import type { Opportunity } from '../../domain/entities/opportunity'
import type { OpportunityRepository } from '../../domain/repositories/opportunity-repository'

export interface OpportunityReadModel {
  opportunity: Opportunity
  applicationCount: number
  attachments: readonly OpportunityRepository[]
}

export type OpportunityResult = OpportunityReadModel

export interface OpportunityListResult {
  items: readonly OpportunityReadModel[]
  nextPageToken: string | null
}

export interface OpportunityListResultWithCursor extends OpportunityListResult {
  cursor: OpportunityRepository | null
}
