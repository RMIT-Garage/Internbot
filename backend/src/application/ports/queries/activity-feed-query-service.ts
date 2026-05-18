import type { UserActivityFeedFilter, UserActivityFeedPage } from '../../read-models/user-activity'

/**
 * Read-only port for the cross-resource activity feed.
 *
 * Activity is a read-model projection across the `internships/*\/activity`
 * and `opportunities/*\/activity` collection groups — there is no
 * "activity aggregate", so the feed has no write-side counterpart. It lives
 * here as a query service rather than as a UoW-bound repository so list
 * traffic does not pay the per-read transactional cost.
 */
export interface ActivityFeedQueryService {
  listByAuthor(filter: UserActivityFeedFilter): Promise<UserActivityFeedPage>
}
