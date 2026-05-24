/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Support ticket record (see WORKFLOW-API-SPEC.md §7.10 / §8.7).
 */
export type TicketResponse = {
  id: string
  userId: string
  subject: string
  body: string
  category: string | null
  status: TicketResponse.status
  version: number
  createdAt: string
  updatedAt: string
}
export namespace TicketResponse {
  export enum status {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed',
  }
}
