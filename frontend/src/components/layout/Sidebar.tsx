import Link from 'next/link'
import { LayoutDashboard, User, Settings } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  return (
    <aside className="hidden w-60 flex-col border-r border-black/10 bg-white lg:flex dark:border-white/10 dark:bg-black">
      <div className="flex h-14 items-center border-b border-black/10 px-4 dark:border-white/10">
        <span className="text-sm font-semibold">{process.env.NEXT_PUBLIC_APP_NAME ?? 'App'}</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-black/70 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
