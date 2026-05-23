/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/internships/:id/offer-submissions. All fields are optional — submission only requires at least one finalized offer attachment. Dates may be supplied later by the coordinator.
 */
export type SubmitInternshipOfferRequest = {
  offerDate?: string
  startDate?: string
  endDate?: string | null
}
