'use client'

import { useAuth } from '@/hooks/useAuth'

export default function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Welcome back{user?.email ? `, ${user.email}` : ''}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(['Metric One', 'Metric Two', 'Metric Three'] as const).map((title) => (
          <div
            key={title}
            className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="text-sm font-medium text-zinc-500">{title}</p>
            <p className="mt-2 text-3xl font-bold">—</p>
          </div>
        ))}
      </div>
    </div>
  )
}
