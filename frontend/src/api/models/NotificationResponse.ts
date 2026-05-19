/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * User notification record.
 */
export type NotificationResponse = {
  id: string
  type: NotificationResponse.type
  title: string
  body: string
  relatedInternshipId: string | null
  relatedOpportunityId: string | null
  relatedTicketId: string | null
  emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'skipped' | null
  emailDeliveredAt: string | null
  readAt: string | null
  createdAt: string
}
export namespace NotificationResponse {
  export enum type {
    OFFER_DECISION = 'offer_decision',
    OPPORTUNITY_VERIFIED = 'opportunity_verified',
    OPPORTUNITY_REJECTED = 'opportunity_rejected',
    NEW_APPLICATION = 'new_application',
    NEW_TICKET = 'new_ticket',
    TICKET_REPLY = 'ticket_reply',
    TICKET_TRANSITION = 'ticket_transition',
  }
}
