/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { UserActivityFeedItemResponse } from './UserActivityFeedItemResponse'
/**
 * Paginated activity feed for the caller.
 */
export type UserActivityFeedResponse = {
  items: Array<UserActivityFeedItemResponse>
  nextPageToken: string | null
}
