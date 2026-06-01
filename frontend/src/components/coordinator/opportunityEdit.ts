import type { OpportunityResponse } from '@/types/api'
import { needsPlacementSuitabilityReview } from '@/lib/coordinator/apiMappers'

export type OpportunityType = 'pre_approved' | 'custom'
export type WorkMode = 'onsite' | 'hybrid' | 'remote'

export interface OpportunityEditFormState {
  title: string
  company: string
  semesterId: string
  descriptionText: string
  sourceUrl: string
  type: OpportunityType
  workMode: WorkMode
  location: string
}

export interface OpportunityEditTarget {
  id: string
  title: string
  company: string
  semesterId: string
  descriptionText: string
  sourceUrl: string | null
  type: OpportunityType
  workMode: WorkMode | null
  location: string | null
  statusRaw: string
  submittedByUserId: string | null
}

export function opportunityRowToEditForm(row: OpportunityEditTarget): OpportunityEditFormState {
  return {
    title: row.title,
    company: row.company,
    semesterId: row.semesterId,
    descriptionText: row.descriptionText,
    sourceUrl: row.sourceUrl ?? '',
    type: row.type,
    workMode: row.workMode ?? 'hybrid',
    location: row.location ?? '',
  }
}

export function opportunityResponseToEditTarget(
  opportunity: OpportunityResponse
): OpportunityEditTarget {
  return {
    id: opportunity.id,
    title: opportunity.jobTitle,
    company: opportunity.employerName,
    semesterId: opportunity.semesterId,
    descriptionText: opportunity.descriptionText,
    sourceUrl: opportunity.sourceUrl,
    type: opportunity.type,
    workMode: opportunity.workMode,
    location: opportunity.location,
    statusRaw: opportunity.status,
    submittedByUserId: opportunity.submittedByUserId,
  }
}

export function canEditManagedOpportunity(input: {
  type: string
  submittedByUserId?: string | null
  statusRaw: string
}) {
  if (
    needsPlacementSuitabilityReview({
      type: input.type as OpportunityType,
      submittedByUserId: input.submittedByUserId ?? null,
      status: input.statusRaw as OpportunityResponse['status'],
    })
  ) {
    return false
  }
  const status = String(input.statusRaw).toLowerCase()
  return status !== 'archived' && status !== 'unpublished_archived'
}
