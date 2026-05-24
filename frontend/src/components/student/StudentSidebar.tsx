'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Bell,
  BrainCircuit,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Lock,
  ScrollText,
  UserCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import type { StudentUserResponse } from '@/lib/api/openapi-client'

const allNavItems = [
  { href: '/student/dashboard', label: 'Dashboard', icon: LayoutDashboard, requiresProfile: false },
  { href: '/student/applications', label: 'Applications', icon: FileCheck2, requiresProfile: true },
  {
    href: '/student/opportunities',
    label: 'Opportunities',
    icon: GraduationCap,
    requiresProfile: true,
  },
  { href: '/student/advisor', label: 'Advisor', icon: BrainCircuit, requiresProfile: false },
  { href: '/student/notifications', label: 'Notifications', icon: Bell, requiresProfile: false },
]

function isProfileComplete(profile: unknown): boolean {
  if (!profile || typeof profile !== 'object') return false
  const user = profile as StudentUserResponse
  return (
    user.onboardingStage === 'profile_complete' || user.studentProfile?.profileStatus === 'complete'
  )
}

export function StudentSidebar() {
  const pathname = usePathname()
  const { profile } = useAuth()

  const profileComplete = isProfileComplete(profile)

  return (
    <aside className="hidden w-72 flex-col border-r border-slate-200 bg-white lg:flex">
      {/* HEADER */}
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

      {/* PROFILE INCOMPLETE BANNER */}
      {!profileComplete && (
        <div className="mx-3 mt-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3">
          <UserCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <p className="text-xs font-semibold text-red-800">Profile incomplete</p>
            <p className="mt-0.5 text-[11px] leading-4 text-red-700">
              Complete your profile to unlock all features.
            </p>
            <Link
              href="/student/semesters"
              className="mt-1.5 inline-block text-[11px] font-bold text-red-800 underline underline-offset-2 hover:text-red-900"
            >
              Complete now →
            </Link>
          </div>
        </div>
      )}

      {/* NAV */}
      <nav className="flex-1 space-y-1.5 p-4">
        {allNavItems.map(({ href, label, icon: Icon, requiresProfile }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          const locked = requiresProfile && !profileComplete

          if (locked) {
            return (
              <div
                key={href}
                title="Complete your profile to unlock"
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 select-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{label}</span>
                <Lock className="h-3 w-3 shrink-0 text-slate-300" />
              </div>
            )
          }

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
    </aside>
  )
}
