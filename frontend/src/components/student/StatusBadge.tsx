import { cn } from '@/lib/utils'

const statusStyles = {
  pending: 'border-black/20 bg-white text-black',
  approved: 'border-black bg-black text-white',
  changes_requested: 'border-red-200 bg-red-50 text-red-700',
  flagged: 'border-red-200 bg-red-50 text-red-700',
  on_track: 'border-black/20 bg-black/5 text-black',
  needs_attention: 'border-red-200 bg-red-50 text-red-700',
  inactive: 'border-black/20 bg-white text-black/50',
  active: 'border-black bg-black text-white',
  archived: 'border-black/20 bg-white text-black/50',
  rejected: 'border-red-200 bg-red-50 text-red-700',
}

const statusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes requested',
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
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        statusStyles[status]
      )}
    >
      {statusLabels[status]}
    </span>
  )
}
