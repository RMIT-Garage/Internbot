import type { Internship } from '../../domain/entities/internship'
import type {
  InternshipAttachment,
  InternshipListCursor,
} from '../../domain/repositories/internship-repository'
import type { InternshipActivity } from '../../domain/value-objects/internship-activity'
import type { OpportunityType } from '../../domain/value-objects/opportunity-enums'

export interface InternshipReadModel {
  internship: Internship
  studentProgramCode: string | undefined
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: OpportunityType
  opportunitySourceUrl: string | undefined
  attachments: readonly InternshipAttachment[]
}

export type InternshipResult = InternshipReadModel

export interface InternshipListResult {
  items: readonly InternshipReadModel[]
  nextPageToken: string | null
}

export interface InternshipListResultWithCursor extends InternshipListResult {
  cursor: InternshipListCursor | null
}

export interface InternshipActivityResult {
  activity: InternshipActivity
}
