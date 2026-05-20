/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for PATCH /api/v1/opportunities/:id. Lifecycle fields are rejected with 400. See WORKFLOW-API-SPEC.md §7.3.
 */
export type PatchOpportunityRequest = {
  employerName?: string
  jobTitle?: string
  descriptionText?: string
  workMode?: 'onsite' | 'hybrid' | 'remote' | null
  location?: string | null
  sourceUrl?: string | null
}
