import type { Internship } from '../entities/internship'
import type { InternshipActivity } from '../value-objects/internship-activity'
import type { InternshipStatus } from '../value-objects/internship-enums'

export interface InternshipAttachment {
  readonly id: string
  readonly fileName: string | undefined
  readonly contentType: string | undefined
  readonly uploadedAt: Date
}

export interface InternshipListCursor {
  readonly sortField: 'createdAt' | 'lastSubmittedAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly lastValue: Date | null
  readonly lastDocId: string
}

export interface InternshipListFilter {
  readonly userId: string | undefined
  readonly opportunityId: string | undefined
  readonly status: readonly InternshipStatus[] | undefined
  readonly limit: number
  readonly sortField: 'createdAt' | 'lastSubmittedAt'
  readonly sortDirection: 'asc' | 'desc'
  readonly cursor: InternshipListCursor | undefined
}

export interface InternshipListPage {
  readonly items: readonly Internship[]
  readonly nextCursor: InternshipListCursor | null
}

export interface InternshipRepository {
  findById(id: string): Promise<Internship | null>
  findByUserIdAndOpportunityId(userId: string, opportunityId: string): Promise<Internship | null>
  list(filter: InternshipListFilter): Promise<InternshipListPage>
  listByUserId(userId: string): Promise<readonly Internship[]>
  listAttachments(internshipId: string): Promise<readonly InternshipAttachment[]>
  hasAttachments(internshipId: string): Promise<boolean>
  create(internship: Internship): Promise<void>
  save(internship: Internship): Promise<void>
  addActivity(internshipId: string, activity: InternshipActivity): Promise<void>
}
