/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for PATCH /api/v1/internships/:id. Lifecycle and ownership fields are rejected with 400.
 */
export type PatchInternshipRequest = {
  offerDate?: string
  startDate?: string
  endDate?: string | null
}
