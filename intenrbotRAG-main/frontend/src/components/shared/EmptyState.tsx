import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: React.ReactNode
}

export function EmptyState({ title, description, icon: Icon = Inbox, action }: EmptyStateProps) {
  return (
    <div className="bg-background flex flex-col items-center justify-center gap-3 rounded-2xl border py-16 text-center">
      <div className="bg-brand-50 dark:bg-brand-50/35 flex h-12 w-12 items-center justify-center rounded-xl">
        <Icon className="text-brand-500 dark:text-brand-900 h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
