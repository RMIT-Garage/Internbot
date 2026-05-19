/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/internships/:id/decisions.
 */
export type DecideInternshipOfferRequest = {
  decision: DecideInternshipOfferRequest.decision
  comment?: string
}
export namespace DecideInternshipOfferRequest {
  export enum decision {
    APPROVED = 'approved',
    REJECTED = 'rejected',
    CHANGES_REQUESTED = 'changes_requested',
  }
}
