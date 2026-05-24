import { cn } from '@/lib/utils'

const statusStyles = {
  applied: 'border-black/20 bg-black/5 text-black/70',

  offer_pending_review: 'border-red-200 bg-red-50 text-red-700',

  offer_approved: 'border-black bg-black text-white',

  offer_changes_requested: 'border-red-600 bg-red-600 text-white',

  rejected: 'border-red-200 bg-white text-red-600',
}

const statusLabels = {
  applied: 'Applied',
  offer_pending_review: 'In review',
  offer_approved: 'Approved',
  offer_changes_requested: 'Action required',
  rejected: 'Rejected',
} as const

export type StudentStatus = keyof typeof statusStyles

interface StatusBadgeProps {
  status: StudentStatus
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
