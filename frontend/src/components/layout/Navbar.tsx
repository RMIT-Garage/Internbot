'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Search, Bell, Settings, UserCircle, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function Navbar() {
  // const router = useRouter()
  // const { signOut } = useAuth()

  // const handleSignOut = async () => {
  //   await signOut()
  //   router.push('/login')
  // }
  const pathname = usePathname()
  const isOnboarding = pathname.startsWith('/onboarding')

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      {/* LEFT SIDE (always exists) */}
      <div className="flex flex-1 items-center">
        {!isOnboarding && (
          <div className="relative w-96">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search internships..."
              className="w-full rounded-lg border border-transparent bg-gray-100 py-2 pr-4 pl-10 text-sm outline-none focus:border-gray-200"
            />
          </div>
        )}
      </div>

      {/* RIGHT SIDE (always pinned right) */}
      <div className="flex items-center gap-4">
        <Bell size={20} className="cursor-pointer text-gray-400 hover:text-gray-600" />
        {/* <Settings size={20} className="cursor-pointer text-gray-400 hover:text-gray-600" /> */}
        <Link href="/profile">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 bg-gray-200 transition hover:bg-gray-300">
            <UserCircle size={24} className="text-gray-400" />
          </div>
        </Link>
      </div>
    </header>
  )
}
