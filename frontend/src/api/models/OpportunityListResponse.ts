/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { OpportunityResponse } from './OpportunityResponse'
/**
 * Paginated list of opportunities.
 */
export type OpportunityListResponse = {
  items: Array<OpportunityResponse>
  nextPageToken: string | null
}
