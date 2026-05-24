/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { InternshipAttachmentResponse } from './InternshipAttachmentResponse'
/**
 * Internship record (see WORKFLOW-API-SPEC.md §7.4 / §8.4).
 */
export type InternshipResponse = {
  id: string
  userId: string
  opportunityId: string
  studentProgramCode: string | null
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: InternshipResponse.opportunityType
  opportunitySourceUrl: string | null
  status: InternshipResponse.status
  version: number
  coordinatorDecision: 'approved' | 'rejected' | 'changes_requested' | null
  coordinatorComment: string | null
  reviewedByUserId: string | null
  reviewedAt: string | null
  offerDate: string | null
  startDate: string | null
  endDate: string | null
  attachmentUploadPathPrefix: string
  attachments: Array<InternshipAttachmentResponse>
  lastSubmittedAt: string | null
  createdAt: string
  updatedAt: string
}
export namespace InternshipResponse {
  export enum opportunityType {
    PRE_APPROVED = 'pre_approved',
    CUSTOM = 'custom',
  }
  export enum status {
    APPLIED = 'applied',
    OFFER_PENDING_REVIEW = 'offer_pending_review',
    OFFER_CHANGES_REQUESTED = 'offer_changes_requested',
    OFFER_APPROVED = 'offer_approved',
    REJECTED = 'rejected',
    WITHDRAWN = 'withdrawn',
  }
}
