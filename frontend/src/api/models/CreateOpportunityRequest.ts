/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/opportunities. Coordinator and student callers have different server-side defaults. See WORKFLOW-API-SPEC.md §7.3.
 */
export type CreateOpportunityRequest = {
  semesterId?: string
  type?: CreateOpportunityRequest.type
  employerName: string
  jobTitle: string
  descriptionText: string
  workMode?: CreateOpportunityRequest.workMode
  location?: string
  sourceUrl?: string
}
export namespace CreateOpportunityRequest {
  export enum type {
    PRE_APPROVED = 'pre_approved',
    CUSTOM = 'custom',
  }
  export enum workMode {
    ONSITE = 'onsite',
    HYBRID = 'hybrid',
    REMOTE = 'remote',
  }
}
