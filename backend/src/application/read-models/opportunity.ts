import type { Opportunity } from '../../domain/entities/opportunity'
import type { Attachment } from '../../domain/value-objects/attachment'
import type {
  OpportunityStatus,
  OpportunityType,
} from '../../domain/value-objects/opportunity-enums'

/* ──────────────────────────────────────────────────────────────────────── */
/* Query input / output models                                              */
/* ──────────────────────────────────────────────────────────────────────── */

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

/* ──────────────────────────────────────────────────────────────────────── */
/* Composite read model — handlers compose it from the queries above        */
/* ──────────────────────────────────────────────────────────────────────── */

export interface OpportunityReadModel {
  opportunity: Opportunity
  applicationCount: number
  attachments: readonly OpportunityAttachment[]
}
