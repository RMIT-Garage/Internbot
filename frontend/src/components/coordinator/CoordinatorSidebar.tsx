'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  BriefcaseBusiness,
  BrainCircuit,
  ClipboardList,
  CalendarDays,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/coordinator/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/coordinator/jobs', label: 'Self-Sourced Jobs', icon: BriefcaseBusiness },
  { href: '/coordinator/contracts', label: 'Contracts', icon: FileCheck2 },
  { href: '/coordinator/students', label: 'Students', icon: Users },
  { href: '/coordinator/semesters', label: 'Semesters', icon: CalendarDays },
  { href: '/coordinator/opportunities', label: 'Opportunities', icon: GraduationCap },
  { href: '/coordinator/ai-advisor', label: 'AI Advisor', icon: BrainCircuit },
  { href: '/coordinator/audits', label: 'Audit Logs', icon: ClipboardList },
  { href: '/coordinator/notifications', label: 'Notifications', icon: Bell },
]

export function CoordinatorSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-700 text-white shadow-sm">
          <ScrollText className="h-4 w-4" />
        </div>
        <div>
          <span className="block text-sm font-bold text-slate-950">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Internbot'}
          </span>
          <span className="block text-xs text-slate-500">Coordinator Hub</span>
        </div>
      </div>
      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)

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
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-200">
            AI Governance
          </p>
          <p className="mt-2 text-sm font-semibold">7 workflow recommendations ready.</p>
          <Link
            href="/coordinator/ai-advisor"
            className="mt-3 inline-flex text-xs font-bold text-red-200 hover:text-white"
          >
            Open advisor
          </Link>
        </div>
      </div>
    </aside>
  )
}
