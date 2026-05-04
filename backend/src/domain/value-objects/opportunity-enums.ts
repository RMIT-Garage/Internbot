export const opportunityTypeValues = ['pre_approved', 'custom'] as const
export type OpportunityType = (typeof opportunityTypeValues)[number]

export const opportunityStatusValues = [
  'draft',
  'pending_verification',
  'published',
  'rejected',
  'archived',
] as const
export type OpportunityStatus = (typeof opportunityStatusValues)[number]

export const opportunityTransitionTargetValues = ['published', 'archived'] as const
export type OpportunityTransitionTarget = (typeof opportunityTransitionTargetValues)[number]

export const opportunityVerificationDecisionValues = ['approved', 'rejected'] as const
export type OpportunityVerificationDecision = (typeof opportunityVerificationDecisionValues)[number]

export const workModeValues = ['onsite', 'hybrid', 'remote'] as const
export type WorkMode = (typeof workModeValues)[number]

export const opportunityActivityTypeValues = ['transition', 'verification'] as const
export type OpportunityActivityType = (typeof opportunityActivityTypeValues)[number]
