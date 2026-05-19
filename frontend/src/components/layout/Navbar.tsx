'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, User } from 'lucide-react'
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
    <header className="flex h-14 items-center justify-between border-b border-black/10 bg-white px-4 dark:border-white/10 dark:bg-black">
      <div className="text-sm font-semibold lg:hidden">
        {process.env.NEXT_PUBLIC_APP_NAME ?? 'App'}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        {user && <span className="hidden text-sm text-black/50 sm:block">{user.email}</span>}
        <Link
          href="/profile"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-700 transition-colors hover:bg-red-100 dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20"
          aria-label="Profile"
        >
          <User className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex h-8 w-8 items-center justify-center rounded-full text-black/40 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-white/10 dark:hover:text-white/80"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
