import { cn } from '@/lib/utils'

const statusStyles = {
  pending:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
  approved:
    'border-slate-300 bg-white text-slate-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
  changes_requested:
    'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300',
  flagged:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300',
  rejected:
    'border-red-300 bg-white text-red-800 dark:border-red-900/60 dark:bg-zinc-950 dark:text-red-200',
  on_track:
    'border-slate-300 bg-slate-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  needs_attention:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200',
  inactive:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  active:
    'border-slate-300 bg-white text-slate-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
  archived:
    'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
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
