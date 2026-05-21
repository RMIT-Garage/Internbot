import type { InternshipRepository } from '../../domain/repositories/internship-repository'
import type { InternshipActivity } from '../../domain/value-objects/internship-activity'
import type { InternshipReadModel } from '../read-models/internship'

export type InternshipResult = InternshipReadModel

export interface InternshipListResult {
  items: readonly InternshipReadModel[]
  nextPageToken: string | null
}

export interface InternshipListResultWithCursor extends InternshipListResult {
  cursor: InternshipRepository | null
}

export interface InternshipActivityResult {
  activity: InternshipActivity
}
