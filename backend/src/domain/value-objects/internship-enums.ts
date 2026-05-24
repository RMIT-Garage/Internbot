export const internshipStatusValues = [
  'applied',
  'offer_pending_review',
  'offer_changes_requested',
  'offer_approved',
  'rejected',
  'withdrawn',
] as const
export type InternshipStatus = (typeof internshipStatusValues)[number]

export const internshipActivityTypeValues = [
  'apply',
  'submit_offer',
  'comment',
  'approve_offer',
  'request_changes',
  'reject',
  'edit',
  'withdraw',
] as const
export type InternshipActivityType = (typeof internshipActivityTypeValues)[number]

export const internshipCoordinatorDecisionValues = [
  'approved',
  'rejected',
  'changes_requested',
] as const
export type InternshipCoordinatorDecision = (typeof internshipCoordinatorDecisionValues)[number]
