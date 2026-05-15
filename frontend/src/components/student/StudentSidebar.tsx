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
  { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    href: '/student/self-sourced-internships',
    label: 'Self-Sourced Internships',
    icon: BriefcaseBusiness,
  },
  { href: '/student/contracts', label: 'Contracts', icon: FileCheck2 },
  { href: '/student/students', label: 'Students', icon: Users },
  { href: '/student/semesters', label: 'Semesters', icon: CalendarDays },
  { href: '/student/opportunities', label: 'Opportunities', icon: GraduationCap },
  { href: '/student/ai-advisor', label: 'AI Advisor', icon: BrainCircuit },
  { href: '/student/audits', label: 'Audit Logs', icon: ClipboardList },
  { href: '/student/notifications', label: 'Notifications', icon: Bell },
]

export function StudentSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
      {/* HEADER — unchanged design */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-700 text-white shadow-sm">
          <ScrollText className="h-4 w-4" />
        </div>

        <div>
          <span className="block text-sm font-bold text-slate-950">
            {process.env.NEXT_PUBLIC_APP_NAME ?? 'Internbot'}
          </span>
          <span className="block text-xs text-slate-500">Student Hub</span>
        </div>
      </div>

      {/* NAV */}
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

      {/* FOOTER — unchanged design */}
      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-950 p-4 text-white">
          <p className="text-xs font-bold tracking-[0.18em] text-red-200 uppercase">AI Learning</p>

          <p className="mt-2 text-sm font-semibold">Learning recommendations ready.</p>

          <Link
            href="/student/ai-advisor"
            className="mt-3 inline-flex text-xs font-bold text-red-200 hover:text-white"
          >
            Open advisor
          </Link>
        </div>
      </div>
    </aside>
  )
}
