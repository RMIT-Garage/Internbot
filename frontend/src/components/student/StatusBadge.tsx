import { cn } from '@/lib/utils'

const statusStyles = {
  applied:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-200',

  offer_pending_review:
    'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900/60 dark:bg-yellow-950/40 dark:text-yellow-200',

  offer_approved:
    'border-green-200 bg-green-50 text-green-800 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-200',

  offer_changes_requested:
    'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-200',

  rejected:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
} as const

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
