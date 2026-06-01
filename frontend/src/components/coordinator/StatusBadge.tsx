import { cn } from '@/lib/utils'

const statusStyles = {
  pending: 'border-red-200 bg-red-50 text-red-700',
  awaiting_placement_approval: 'border-red-200 bg-red-50 text-red-700',
  awaiting_contract_review: 'border-black/20 bg-black/5 text-black/70',
  awaiting_contract_details: 'border-black/20 bg-black/5 text-black/70',
  awaiting_review: 'border-red-200 bg-red-50 text-red-700',
  awaiting_documents: 'border-red-600 bg-red-600 text-white',
  awaiting_approval: 'border-black/20 bg-black/5 text-black/70',
  approved: 'border-black bg-black text-white',
  changes_requested: 'border-red-600 bg-red-600 text-white',
  flagged: 'border-red-200 bg-red-50 text-red-700',
  rejected: 'border-red-200 bg-white text-red-600',
  on_track: 'border-black/20 bg-black/5 text-black/70',
  needs_attention: 'border-red-200 bg-red-50 text-red-700',
  inactive: 'border-gray-200 bg-gray-50 text-gray-400',
  active: 'border-black bg-black text-white',
  archived: 'border-gray-200 bg-gray-50 text-gray-400',
}

const statusLabels = {
  pending: 'Pending',
  awaiting_placement_approval: 'Awaiting Placement Approval',
  awaiting_contract_review: 'Awaiting Contract Review',
  awaiting_contract_details: 'Awaiting Contract Details',
  awaiting_review: 'Awaiting Review',
  awaiting_documents: 'Awaiting Documents',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  changes_requested: 'Awaiting Documents',
  flagged: 'Flagged',
  on_track: 'On track',
  needs_attention: 'Needs attention',
  inactive: 'Inactive',
  active: 'Active',
  archived: 'Archived',
  rejected: 'Rejected',
}

export type CoordinatorStatus = keyof typeof statusStyles

interface StatusBadgeProps {
  status: CoordinatorStatus
  label?: string
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status]
      )}
    >
      {label ?? statusLabels[status]}
    </span>
  )
}
