'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, GraduationCap, PenLine, ShieldCheck, UserCircle2 } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload } from '../types'
import { ProfileEditForm } from './ProfileEditForm'
import { AnalyticsStrip, CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

export function ProfileView({ user, onSave, saving }: Props) {
  const [editing, setEditing] = useState(false)
  const { studentProfile, displayName, email } = user
  const ai = studentProfile.academicInfo

  const isComplete = studentProfile.profileStatus === 'complete'
  const programLevelLabel = ai?.programLevel === 'undergraduate' ? 'Undergraduate' : 'Postgraduate'
  const initials = (displayName ?? email).charAt(0).toUpperCase()
  const healthProgress = isComplete ? 100 : 50

  const handleSave = async (payload: UpdateProfilePayload) => {
    await onSave(payload)
    setEditing(false)
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="Profile"
        description="Your personal details, academic program, and placement readiness."
        actions={
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-red-800"
          >
            <PenLine className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SurfaceCard className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-2xl font-bold text-red-700 ring-1 ring-red-100">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-600 uppercase">
                  Student ID · {studentProfile.studentNumber}
                </span>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
                  {displayName ?? '—'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {ai?.programName ?? 'Program not set'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {ai?.programLevel && (
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-100">
                      {programLevelLabel}
                    </span>
                  )}
                  {ai?.currentStudyLoad && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                      {ai.currentStudyLoad.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </SurfaceCard>

          <ProfileSection title="Personal details">
            <div className="grid gap-4 sm:grid-cols-2">
              <DataField label="Full name" value={displayName} />
              <DataField label="Email address" value={email} />
              <DataField label="Phone number" value={studentProfile.phone} />
              <DataField label="Program code" value={studentProfile.programCode} />
            </div>
          </ProfileSection>

          <ProfileSection title="Academic program">
            <div className="grid gap-4 sm:grid-cols-2">
              <DataField label="Declared majors" value={ai?.majors?.join(', ') ?? null} />
              <DataField label="Declared minors" value={ai?.minors?.join(', ') ?? null} />
              <DataField
                label="Study load"
                value={ai?.currentStudyLoad?.replace(/_/g, ' ') ?? null}
              />
              <DataField
                label="Program status"
                value={ai?.programStatus?.replace(/_/g, ' ') ?? null}
              />
            </div>
          </ProfileSection>

          <div className="space-y-3">
            <h3 className="px-1 text-sm font-bold text-slate-950">Academic record</h3>
            <AnalyticsStrip
              items={[
                {
                  label: 'Current GPA',
                  value: ai?.gpa?.toString() ?? '—',
                  detail: 'Weighted average',
                  tone: 'red',
                },
                {
                  label: 'CP earned',
                  value: ai?.creditUnitsEarned?.toString() ?? '—',
                  detail: 'Credit points completed',
                  tone: 'charcoal',
                },
                {
                  label: 'Units attempted',
                  value: ai?.unitsAttempted?.toString() ?? '—',
                  detail: 'Total units enrolled',
                  tone: 'neutral',
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-950">Profile health</h3>
              <span
                className={`text-xs font-bold ${isComplete ? 'text-green-700' : 'text-amber-700'}`}
              >
                {isComplete ? 'Complete' : 'Incomplete'}
              </span>
            </div>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100">
              <div
                className={`h-2 rounded-full transition-all ${isComplete ? 'bg-red-700' : 'bg-amber-400'}`}
                style={{ width: `${healthProgress}%` }}
              />
            </div>
            {isComplete ? (
              <div className="mt-5 flex gap-3 rounded-xl border border-green-100 bg-green-50 p-4">
                <ShieldCheck className="h-5 w-5 shrink-0 text-green-700" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-green-900">Ready for placements</p>
                  <p className="mt-1 text-xs leading-5 text-green-800">
                    Your profile is visible to coordinators when you apply.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex gap-3 rounded-xl border border-amber-100 bg-amber-50 p-4">
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-amber-900">Setup still required</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Complete your academic details and semester selection to unlock opportunities.
                  </p>
                  <Link
                    href="/student/semesters"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-red-700 hover:text-red-800"
                  >
                    Continue setup →
                  </Link>
                </div>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-red-700" aria-hidden />
              <h3 className="text-sm font-bold text-slate-950">Need to update details?</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Keep your phone, program, and academic record current so coordinators can review your
              applications accurately.
            </p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Edit profile
            </button>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <UserCircle2 className="h-4 w-4 text-red-700" aria-hidden />
              <h3 className="text-sm font-bold text-slate-950">Account</h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{email}</p>
            <p className="mt-1 text-xs text-slate-400">Signed in with your RMIT student account.</p>
          </SurfaceCard>
        </div>
      </div>

      {editing && (
        <ProfileEditForm
          user={user}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      )}
    </div>
  )
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-3">
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </SurfaceCard>
  )
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value ?? '—'}</p>
    </div>
  )
}
