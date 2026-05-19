/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/tickets. See WORKFLOW-API-SPEC.md §7.10.
 */
export type CreateTicketRequest = {
  subject: string
  body: string
  category?: string
}
