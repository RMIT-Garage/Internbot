/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Activity entry under internships/{id}/activity.
 */
export type InternshipActivityResponse = {
  id: string
  type: InternshipActivityResponse.type
  authorUserId: string
  authorRole: InternshipActivityResponse.authorRole
  text: string | null
  createdAt: string
}
export namespace InternshipActivityResponse {
  export enum type {
    APPLY = 'apply',
    SUBMIT_OFFER = 'submit_offer',
    COMMENT = 'comment',
    APPROVE_OFFER = 'approve_offer',
    REQUEST_CHANGES = 'request_changes',
    REJECT = 'reject',
    EDIT = 'edit',
    WITHDRAW = 'withdraw',
  }
  export enum authorRole {
    STUDENT = 'student',
    COORDINATOR = 'coordinator',
  }
}
