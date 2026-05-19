import { cn } from '@/lib/utils'

const statusStyles = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300',
  approved:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
  changes_requested:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  flagged:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
  on_track:
    'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-300',
  needs_attention:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/40 dark:text-orange-300',
  inactive:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  active:
    'border-zinc-800 bg-zinc-950 text-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-white',
  archived:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  rejected:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
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
