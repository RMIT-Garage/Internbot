/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TicketListItemResponse } from './TicketListItemResponse'
/**
 * Paginated list of tickets.
 */
export type TicketListResponse = {
  items: Array<TicketListItemResponse>
  nextPageToken: string | null
}
