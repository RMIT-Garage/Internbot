/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Internship list item with query-time denormalized display fields.
 */
export type InternshipListItemResponse = {
  id: string
  userId: string
  opportunityId: string
  studentProgramCode: string | null
  opportunityEmployerName: string
  opportunityJobTitle: string
  opportunityType: InternshipListItemResponse.opportunityType
  opportunitySourceUrl: string | null
  semesterId: string
  semesterDisplayName: string
  semesterCode: string
  status: InternshipListItemResponse.status
  lastSubmittedAt: string | null
  createdAt: string
}
export namespace InternshipListItemResponse {
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
