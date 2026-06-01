/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * One activity-feed entry authored by the caller.
 */
export type UserActivityFeedItemResponse = {
  id: string
  resourceType: UserActivityFeedItemResponse.resourceType
  internshipId: string | null
  opportunityId: string | null
  type: UserActivityFeedItemResponse.type
  authorUserId: string
  authorRole: UserActivityFeedItemResponse.authorRole
  text: string | null
  from:
    | 'applied'
    | 'offer_pending_review'
    | 'offer_changes_requested'
    | 'offer_approved'
    | 'rejected'
    | 'withdrawn'
    | 'draft'
    | 'pending_verification'
    | 'published'
    | 'archived'
    | null
  to:
    | 'applied'
    | 'offer_pending_review'
    | 'offer_changes_requested'
    | 'offer_approved'
    | 'rejected'
    | 'withdrawn'
    | 'draft'
    | 'pending_verification'
    | 'published'
    | 'archived'
    | null
  decision: 'approved' | 'rejected' | null
  createdAt: string
}
export namespace UserActivityFeedItemResponse {
  export enum resourceType {
    INTERNSHIP = 'internship',
    OPPORTUNITY = 'opportunity',
  }
  export enum type {
    APPLY = 'apply',
    SUBMIT_OFFER = 'submit_offer',
    COMMENT = 'comment',
    APPROVE_OFFER = 'approve_offer',
    REQUEST_CHANGES = 'request_changes',
    REJECT = 'reject',
    EDIT = 'edit',
    WITHDRAW = 'withdraw',
    TRANSITION = 'transition',
    VERIFICATION = 'verification',
  }
  export enum authorRole {
    STUDENT = 'student',
    COORDINATOR = 'coordinator',
  }
}
