import type { Opportunity } from '../../domain/entities/opportunity'
import type {
  OpportunityAttachment,
  OpportunityListCursor,
} from '../../domain/repositories/opportunity-repository'

export interface OpportunityReadModel {
  opportunity: Opportunity
  applicationCount: number
  attachments: readonly OpportunityAttachment[]
}

export type OpportunityResult = OpportunityReadModel

export interface OpportunityListResult {
  items: readonly OpportunityReadModel[]
  nextPageToken: string | null
}

export interface OpportunityListResultWithCursor extends OpportunityListResult {
  cursor: OpportunityListCursor | null
}
