'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRedirectIfAuthed } from '@/hooks/useRequireAuth'
import { AuthLogo } from '@/features/auth/components/AuthLogo'
import { StaffLoginForm } from '@/features/auth/components/StaffLoginForm'
import { StudentSsoButton } from '@/features/auth/components/StudentSsoButton'

type Tab = 'student' | 'staff'

export default function LoginPage() {
  useRedirectIfAuthed()
  const [tab, setTab] = useState<Tab>('student')

  return (
    <div className="relative isolate flex min-h-screen flex-col bg-zinc-950 text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(56,89,153,0.45),transparent_70%),linear-gradient(to_bottom,#0b1220,#050810_60%,#000)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 -z-10 h-1/3 bg-gradient-to-t from-black/80 to-transparent"
      />

      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Welcome to Internbot
            </h1>
            <p className="text-[11px] font-semibold tracking-[0.25em] text-zinc-300 uppercase">
              Institutional Internship Portal
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 text-zinc-900 shadow-2xl ring-1 ring-black/5 sm:p-8">
            <div role="tablist" aria-label="Sign in role" className="flex border-b border-zinc-200">
              <TabButton
                id="tab-student"
                panelId="panel-student"
                active={tab === 'student'}
                onClick={() => setTab('student')}
              >
                Student Login
              </TabButton>
              <TabButton
                id="tab-staff"
                panelId="panel-staff"
                active={tab === 'staff'}
                onClick={() => setTab('staff')}
              >
                Staff Login
              </TabButton>
            </div>

            <div className="pt-6">
              {tab === 'student' ? (
                <section
                  id="panel-student"
                  role="tabpanel"
                  aria-labelledby="tab-student"
                  className="space-y-6"
                >
                  <p className="text-center text-sm leading-6 text-zinc-500">
                    Access your career dashboard, track internship progress, and manage your
                    professional portfolio.
                  </p>
                  <StudentSsoButton />
                  <p className="text-center text-xs text-zinc-500">
                    Don&apos;t have an account?{' '}
                    <Link href="/register" className="text-brand-600 font-medium hover:underline">
                      Create one
                    </Link>
                  </p>
                </section>
              ) : (
                <section
                  id="panel-staff"
                  role="tabpanel"
                  aria-labelledby="tab-staff"
                  className="space-y-6"
                >
                  <div className="flex flex-col items-center gap-2">
                    <AuthLogo />
                    <p className="text-center text-sm text-zinc-500">
                      Access the administrative dashboard.
                    </p>
                  </div>
                  <StaffLoginForm />
                </section>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center gap-4 border-t border-zinc-100 pt-4 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              <Link href="/support" className="hover:text-zinc-600">
                Technical Support
              </Link>
              <span aria-hidden="true">·</span>
              <Link href="/privacy" className="hover:text-zinc-600">
                Privacy Statement
              </Link>
            </div>
          </div>

          <dl className="flex items-center justify-center gap-12 text-center text-zinc-200">
            <Stat value="450+" label="Partners" />
            <Stat value="2.4k" label="Placements" />
          </dl>
        </div>
      </main>
    </div>
  )
}

function TabButton({
  id,
  panelId,
  active,
  onClick,
  children,
}: {
  id: string
  panelId: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      aria-controls={panelId}
      aria-selected={active}
      onClick={onClick}
      className={`-mb-px flex-1 border-b-2 px-3 py-2 text-[11px] font-semibold tracking-wider uppercase transition-colors ${
        active
          ? 'border-brand-500 text-zinc-900'
          : 'border-transparent text-zinc-400 hover:text-zinc-600'
      }`}
    >
      {children}
    </button>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <dt className="text-2xl font-bold tracking-tight">{value}</dt>
      <dd className="text-[11px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
        {label}
      </dd>
    </div>
  )
}
