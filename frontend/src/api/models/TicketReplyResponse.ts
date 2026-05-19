/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Reply on a ticket conversation thread.
 */
export type TicketReplyResponse = {
  id: string
  authorUserId: string
  authorRole: TicketReplyResponse.authorRole
  text: string
  createdAt: string
}
export namespace TicketReplyResponse {
  export enum authorRole {
    STUDENT = 'student',
    COORDINATOR = 'coordinator',
  }
}
