/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OpportunityAttachmentResponse } from './OpportunityAttachmentResponse'
/**
 * Opportunity record (see WORKFLOW-API-SPEC.md §7.3 / §8.3).
 */
export type OpportunityResponse = {
  id: string
  semesterId: string
  type: OpportunityResponse.type
  employerName: string
  jobTitle: string
  descriptionText: string
  workMode: 'onsite' | 'hybrid' | 'remote' | null
  location: string | null
  sourceUrl: string | null
  status: OpportunityResponse.status
  applicationCount: number
  createdByUserId: string | null
  submittedByUserId: string | null
  verifiedByUserId: string | null
  verifiedAt: string | null
  attachmentUploadPathPrefix: string
  attachments: Array<OpportunityAttachmentResponse>
  createdAt: string
  updatedAt: string
}
export namespace OpportunityResponse {
  export enum type {
    PRE_APPROVED = 'pre_approved',
    CUSTOM = 'custom',
  }
  export enum status {
    DRAFT = 'draft',
    PENDING_VERIFICATION = 'pending_verification',
    PUBLISHED = 'published',
    REJECTED = 'rejected',
    ARCHIVED = 'archived',
  }
}
