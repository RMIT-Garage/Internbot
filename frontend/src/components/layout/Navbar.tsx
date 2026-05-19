'use client'

import Link from 'next/link'
import { Bell, LogOut, Search, User } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const isCoordinatorArea = pathname?.startsWith('/coordinator') ?? false

  const handleSignOut = async () => {
    await signOut()
    router.push(isCoordinatorArea ? '/coordinator/login' : '/login')
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur xl:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="hidden h-10 w-full max-w-md items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 md:flex">
          <Search className="h-4 w-4" />
          Search anything...
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-600" />
        </Link>
        <Link
          href="/profile"
          className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 transition hover:bg-slate-50 md:flex"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-white">
            <User className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900">Student</p>

            <p className="truncate text-[11px] text-slate-500">{user?.email ?? 'Student portal'}</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
