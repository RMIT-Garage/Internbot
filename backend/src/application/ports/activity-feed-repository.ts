import type { UserActivityFeedCursor, UserActivityFeedItem } from '../models/user-activity'

export interface UserActivityFeedFilter {
  readonly authorUserId: string
  readonly limit: number
  readonly sortDirection: 'asc' | 'desc'
  readonly cursor: UserActivityFeedCursor | undefined
}

export interface UserActivityFeedPage {
  readonly items: readonly UserActivityFeedItem[]
  readonly nextCursor: UserActivityFeedCursor | null
}

/**
 * Read-model repository for the cross-resource activity feed.
 *
 * Activity feed reads intentionally live behind an application port instead
 * of an aggregate repository: the query spans activity collection groups
 * and returns DTO-ready timeline rows, not a single aggregate root.
 */
export interface ActivityFeedRepository {
  listByAuthor(filter: UserActivityFeedFilter): Promise<UserActivityFeedPage>
}
