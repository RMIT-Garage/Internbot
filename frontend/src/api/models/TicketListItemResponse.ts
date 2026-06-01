/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Support ticket list item — body and replies are omitted from list responses.
 */
export type TicketListItemResponse = {
  id: string
  userId: string
  subject: string
  category: string | null
  status: TicketListItemResponse.status
  createdAt: string
  updatedAt: string
}
export namespace TicketListItemResponse {
  export enum status {
    OPEN = 'open',
    IN_PROGRESS = 'in_progress',
    RESOLVED = 'resolved',
    CLOSED = 'closed',
  }
}
