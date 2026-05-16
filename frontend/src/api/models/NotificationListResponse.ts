/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { NotificationResponse } from './NotificationResponse'
/**
 * Paginated notifications plus total unread count for the caller.
 */
export type NotificationListResponse = {
  items: Array<NotificationResponse>
  nextPageToken: string | null
  unreadCount: number
}
