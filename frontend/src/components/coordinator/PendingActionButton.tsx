'use client'

import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface PendingActionButtonProps {
  children: ReactNode
  message?: string
  className?: string
}

export function PendingActionButton({
  children,
  message = 'API integration pending. This action is not connected yet.',
  className,
}: PendingActionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => toast.info(message)}
      className={cn(
        'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50',
        className
      )}
    >
      {children}
    </button>
  )
}
