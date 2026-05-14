import type { Internship } from '../../domain/entities/internship'
import type { Attachment } from '../../domain/value-objects/attachment'
import type { InternshipStatus } from '../../domain/value-objects/internship-enums'
import type { OpportunityType } from '../../domain/value-objects/opportunity-enums'
import { NotFoundError } from '../../domain/errors'
import type { UserQueryService } from '../ports/queries/user-query-service'
import type { OpportunityQueryService } from '../ports/queries/opportunity-query-service'
import type { InternshipQueryService } from '../ports/queries/internship-query-service'

/* ──────────────────────────────────────────────────────────────────────── */
/* Query input / output models                                              */
/* ──────────────────────────────────────────────────────────────────────── */

export type InternshipAttachment = Attachment

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

/* ──────────────────────────────────────────────────────────────────────── */
/* Composite read model used by GET /internships/{id} and list responses    */
/* ──────────────────────────────────────────────────────────────────────── */

export interface InternshipReadModel {
  internship: Internship
  studentProgramCode: string | undefined
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: OpportunityType
  opportunitySourceUrl: string | undefined
  attachments: readonly InternshipAttachment[]
}

/**
 * Deps required to assemble the composite internship read model. Pulled
 * from query services (read side) — the read model never participates in
 * the write-side UnitOfWork transaction.
 */
export interface InternshipReadModelDeps {
  users: UserQueryService
  opportunities: OpportunityQueryService
  internships: InternshipQueryService
}

export async function buildInternshipReadModel(
  deps: InternshipReadModelDeps,
  internship: Internship
): Promise<InternshipReadModel> {
  const [student, opportunity, attachments] = await Promise.all([
    deps.users.findById(internship.userId),
    deps.opportunities.findById(internship.opportunityId),
    deps.internships.listAttachments(internship.id),
  ])

  if (!student || !student.isStudent()) throw new NotFoundError('User', internship.userId)
  if (!opportunity) throw new NotFoundError('Opportunity', internship.opportunityId)

  return {
    internship,
    studentProgramCode: student.studentProfile.programCode,
    opportunityEmployerName: opportunity.employerName,
    opportunityJobTitle: opportunity.jobTitle,
    opportunityType: opportunity.type,
    opportunitySourceUrl: opportunity.sourceUrl,
    attachments,
  }
}
