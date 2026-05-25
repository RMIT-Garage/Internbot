'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import { AppLogo } from '@/components/brand/AppLogo'
import { cn } from '@/lib/utils'
import {
  PLACEMENT_PROCESSING_CONTEXT,
  SELF_SOURCED_REVIEW_CONTEXT,
} from '@/lib/coordinator/reviewRouting'

export const navItems = [
  { href: '/coordinator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/coordinator/opportunities',
    label: 'Internship Opportunities',
    icon: GraduationCap,
    sections: ['Published Opportunities', 'Self-Sourced Reviews'],
  },
  {
    href: '/coordinator/jobs',
    label: 'Placement Processing',
    icon: BriefcaseBusiness,
    sections: ['Active Placements', 'Contract Review', 'Final Approval'],
  },
  { href: '/coordinator/students', label: 'Students', icon: Users },
  { href: '/coordinator/tickets', label: 'Tickets', icon: MessageSquare },
  { href: '/coordinator/semesters', label: 'Semesters', icon: CalendarDays },
  { href: '/coordinator/notifications', label: 'Notifications', icon: Bell },
  { href: '/coordinator/assistant', label: 'AI Assistant', icon: Sparkles },
]

export function CoordinatorSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeContext = getActiveContext(pathname, searchParams)

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <AppLogo />
        <div>
          <span className="block text-sm font-bold text-slate-950">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Internbot'}
          </span>
          <span className="block text-xs text-slate-500">Placement Operations</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map(({ href, label, icon: Icon, sections }) => {
          const active =
            activeContext === href ||
            (!activeContext && (pathname === href || pathname.startsWith(`${href}/`)))

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
                active
                  ? 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                <span className="block truncate">{label}</span>
                {sections && active && (
                  <span className="mt-1 block text-[11px] leading-4 font-semibold text-slate-500">
                    {sections.join(' / ')}
                  </span>
                )}
              </span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

function getActiveContext(pathname: string, searchParams: { get(name: string): string | null }) {
  if (
    pathname === '/coordinator/jobs/review' &&
    (searchParams.get('tab') === 'self-sourced' ||
      searchParams.get('context') === SELF_SOURCED_REVIEW_CONTEXT)
  ) {
    return '/coordinator/opportunities'
  }

  if (
    searchParams.get('context') === PLACEMENT_PROCESSING_CONTEXT ||
    pathname === '/coordinator/contracts/review'
  ) {
    return '/coordinator/jobs'
  }

  return null
}
