/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/opportunities/:id/verifications. See WORKFLOW-API-SPEC.md §7.3.
 */
export type VerifyOpportunityRequest = {
  decision: VerifyOpportunityRequest.decision
  comment?: string
}
export namespace VerifyOpportunityRequest {
  export enum decision {
    APPROVED = 'approved',
    REJECTED = 'rejected',
  }
}
