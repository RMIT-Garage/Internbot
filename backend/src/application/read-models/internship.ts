import type { UnitOfWorkContext } from '../ports/unit-of-work'
import type { Internship } from '../../domain/entities/internship'
import type { InternshipAttachment } from '../../domain/repositories/internship-repository'
import type { OpportunityType } from '../../domain/value-objects/opportunity-enums'
import { NotFoundError } from '../../domain/errors'

export interface InternshipReadModel {
  internship: Internship
  studentProgramCode: string | undefined
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: OpportunityType
  opportunitySourceUrl: string | undefined
  attachments: readonly InternshipAttachment[]
}

export async function buildInternshipReadModel(
  ctx: UnitOfWorkContext,
  internship: Internship
): Promise<InternshipReadModel> {
  const [student, opportunity, attachments] = await Promise.all([
    ctx.users.findById(internship.userId),
    ctx.opportunities.findById(internship.opportunityId),
    ctx.internships.listAttachments(internship.id),
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
