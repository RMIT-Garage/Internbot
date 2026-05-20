/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { MarkAllNotificationsReadRequest } from '../models/MarkAllNotificationsReadRequest'
import type { MarkAllNotificationsReadResponse } from '../models/MarkAllNotificationsReadResponse'
import type { MarkNotificationReadRequest } from '../models/MarkNotificationReadRequest'
import type { NotificationListResponse } from '../models/NotificationListResponse'
import type { NotificationResponse } from '../models/NotificationResponse'
import type { CancelablePromise } from '../core/CancelablePromise'
import { OpenAPI } from '../core/OpenAPI'
import { request as __request } from '../core/request'
export class NotificationsService {
  /**
   * List the caller's notifications
   * Returns only notifications owned by the authenticated platform user, newest first. `unreadCount` is total unread across all pages. See WORKFLOW-API-SPEC.md §7.8.
   * @param unreadOnly When true, return only unread notifications.
   * @param limit
   * @param pageToken
   * @returns NotificationListResponse Paginated list of notifications.
   * @throws ApiError
   */
  public static listNotifications(
    unreadOnly?: 'true' | 'false',
    limit?: number,
    pageToken?: string
  ): CancelablePromise<NotificationListResponse> {
    return __request(OpenAPI, {
      method: 'GET',
      url: '/api/v1/notifications',
      query: {
        unreadOnly: unreadOnly,
        limit: limit,
        pageToken: pageToken,
      },
      errors: {
        400: `Malformed query string or page token.`,
        401: `Missing or invalid Firebase ID token.`,
      },
    })
  }
  /**
   * Mark all caller notifications as read
   * Scopes the bulk operation to the authenticated platform user's unread notifications. See WORKFLOW-API-SPEC.md §7.8.
   * @param requestBody
   * @returns MarkAllNotificationsReadResponse Bulk mark-read completed.
   * @throws ApiError
   */
  public static markAllNotificationsRead(
    requestBody: MarkAllNotificationsReadRequest
  ): CancelablePromise<MarkAllNotificationsReadResponse> {
    return __request(OpenAPI, {
      method: 'PUT',
      url: '/api/v1/notifications',
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains unsupported fields or \`read\` is not true.`,
        401: `Missing or invalid Firebase ID token.`,
      },
    })
  }
  /**
   * Mark a notification as read
   * Owner-only. The only supported mutation is `read: true`; resetting to unread is not supported in v1. See WORKFLOW-API-SPEC.md §7.8.
   * @param id Platform notification id.
   * @param requestBody
   * @returns NotificationResponse Notification marked read, or already read.
   * @throws ApiError
   */
  public static markNotificationRead(
    id: string,
    requestBody: MarkNotificationReadRequest
  ): CancelablePromise<NotificationResponse> {
    return __request(OpenAPI, {
      method: 'PATCH',
      url: '/api/v1/notifications/{id}',
      path: {
        id: id,
      },
      body: requestBody,
      mediaType: 'application/json',
      errors: {
        400: `Body contains unsupported fields or \`read\` is not true.`,
        401: `Missing or invalid Firebase ID token.`,
        403: `Caller is not the notification owner.`,
        404: `Notification does not exist.`,
      },
    })
  }
}
