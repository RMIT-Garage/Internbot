import { cn } from '@/lib/utils'

const statusStyles = {
  pending:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  awaiting_placement_approval:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  awaiting_contract_review:
    'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200',
  awaiting_contract_details:
    'border-slate-300 bg-slate-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  awaiting_review:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  awaiting_documents:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
  awaiting_approval:
    'border-slate-300 bg-slate-50 text-slate-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  approved:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200',
  changes_requested:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200',
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
