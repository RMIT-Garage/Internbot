/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/opportunities/:id/transitions. See WORKFLOW-API-SPEC.md §7.3.
 */
export type TransitionOpportunityRequest = {
  to: TransitionOpportunityRequest.to
  comment?: string
}
export namespace TransitionOpportunityRequest {
  export enum to {
    PUBLISHED = 'published',
    ARCHIVED = 'archived',
  }
}
