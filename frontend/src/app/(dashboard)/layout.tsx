'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    )
  }

  return <DashboardShell>{children}</DashboardShell>
}
