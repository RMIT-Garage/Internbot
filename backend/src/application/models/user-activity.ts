import type {
  InternshipActivityType,
  InternshipStatus,
} from '../../domain/value-objects/internship-enums'
import type {
  OpportunityActivityType,
  OpportunityStatus,
  OpportunityVerificationDecision,
} from '../../domain/value-objects/opportunity-enums'
import type { Role } from '../../domain/value-objects/user-enums'

export type ActivityFeedResourceType = 'internship' | 'opportunity'
export type ActivityFeedType = InternshipActivityType | OpportunityActivityType
export type ActivityFeedStatus = InternshipStatus | OpportunityStatus

export interface UserActivityFeedItem {
  readonly id: string
  readonly resourceType: ActivityFeedResourceType
  readonly internshipId: string | undefined
  readonly opportunityId: string | undefined
  readonly type: ActivityFeedType
  readonly authorUserId: string
  readonly authorRole: Role
  readonly text: string | undefined
  readonly from: ActivityFeedStatus | undefined
  readonly to: ActivityFeedStatus | undefined
  readonly decision: OpportunityVerificationDecision | undefined
  readonly createdAt: Date
}

export interface UserActivityFeedCursor {
  readonly sortDirection: 'asc' | 'desc'
  readonly lastCreatedAt: Date
  readonly lastDocPath: string
}

export interface UserActivityFeedResult {
  readonly items: readonly UserActivityFeedItem[]
  readonly nextPageToken: string | null
}

export interface UserActivityFeedResultWithCursor extends UserActivityFeedResult {
  readonly cursor: UserActivityFeedCursor | null
}
