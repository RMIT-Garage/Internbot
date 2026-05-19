/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
/**
 * Body for PATCH /api/v1/notifications/:id.
 */
export type MarkNotificationReadRequest = {
  /**
   * Must be true. Resetting notifications to unread is not supported in v1.
   */
  read: boolean
}
