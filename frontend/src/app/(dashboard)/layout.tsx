'use client'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { useRequireAuth } from '@/hooks/useRequireAuth'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useRequireAuth()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-black/20 border-t-red-600 dark:border-white/20 dark:border-t-red-400" />
      </div>
    )
  }

  return <DashboardShell>{children}</DashboardShell>
}
