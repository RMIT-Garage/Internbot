'use client'

import { usePathname } from 'next/navigation'
import { CoordinatorShell } from '@/components/coordinator/CoordinatorShell'
import { isCoordinatorLoginPath } from '@/lib/coordinator/auth'
import { useRequireCoordinatorAuth } from '@/lib/coordinator/useCoordinatorRouteGuard'

export default function CoordinatorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isLoginPage = isCoordinatorLoginPath(pathname)
  const { ready } = useRequireCoordinatorAuth({ disabled: isLoginPage })

  if (isLoginPage) {
    return <>{children}</>
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />
      </div>
    )
  }

  return (
    <CoordinatorShell>
      <div key={pathname}>{children}</div>
    </CoordinatorShell>
  )
}
