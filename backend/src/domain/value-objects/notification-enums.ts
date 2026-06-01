export const notificationTypeValues = [
  'offer_decision',
  'opportunity_verified',
  'opportunity_rejected',
  'new_application',
  'new_ticket',
  'ticket_reply',
  'ticket_transition',
  'semester_phase_changed',
] as const
export type NotificationType = (typeof notificationTypeValues)[number]

export const emailDeliveryStatusValues = ['pending', 'sent', 'failed', 'skipped'] as const
export type EmailDeliveryStatus = (typeof emailDeliveryStatusValues)[number]
