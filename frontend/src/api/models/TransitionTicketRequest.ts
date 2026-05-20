/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for POST /api/v1/tickets/:id/transitions.
 */
export type TransitionTicketRequest = {
  to: TransitionTicketRequest.to
  comment?: string
}
export namespace TransitionTicketRequest {
  export enum to {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed',
  }
}
