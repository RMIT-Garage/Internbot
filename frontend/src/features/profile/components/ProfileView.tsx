'use client'

import { useState } from 'react'
import { ShieldCheck, AlertCircle, ExternalLink, Settings, Wand2 } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload } from '../types'
import { ProfileEditForm } from './ProfileEditForm'

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

  const handleSave = async (payload: UpdateProfilePayload) => {
    await onSave(payload)
    setEditing(false)
  }

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-3 gap-8 p-8">
      {/* ── Left column ── */}
      <div className="col-span-2 space-y-8">
        {/* Profile header card */}
        <div className="relative flex gap-6 overflow-hidden rounded-xl border border-gray-200 bg-white p-8">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-red-600" />
          <div className="relative shrink-0">
            <div className="flex h-28 w-28 items-center justify-center rounded-2xl border-4 border-red-100 bg-red-50 text-4xl font-bold text-red-300 select-none">
              {(displayName ?? email).charAt(0).toUpperCase()}
            </div>
            <button className="absolute -right-1 -bottom-1 rounded-full border-2 border-white bg-red-600 p-1.5 text-white">
              <Settings size={14} />
            </button>
          </div>
          <div className="space-y-2">
            <span className="rounded bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600">
              STUDENT ID: {studentProfile.studentNumber}
            </span>
            <h2 className="text-3xl font-bold">{displayName ?? '—'}</h2>
            <p className="text-gray-500">{ai?.programName ?? 'Program not set'}</p>
            <div className="flex gap-2 pt-2">
              {ai?.programLevel && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 uppercase">
                  {programLevelLabel}
                </span>
              )}
              {ai?.currentStudyLoad && (
                <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white uppercase">
                  {ai.currentStudyLoad.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Personal details */}
        <Section title="Personal Details" onEdit={() => setEditing(true)}>
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Full Name" value={displayName} />
            <DataField label="Email Address" value={email} />
            <DataField label="Phone Number" value={studentProfile.phone} />
          </div>
        </Section>

        {/* Academic program */}
        <Section title="Academic Program">
          <div className="grid grid-cols-2 gap-4">
            <DataField label="Declared Majors" value={ai?.majors?.join(', ') ?? null} />
            <DataField label="Declared Minors" value={ai?.minors?.join(', ') ?? null} />
            <DataField label="Study Load" value={ai?.currentStudyLoad?.replace('_', ' ') ?? null} />
            <DataField
              label="Program Status"
              value={ai?.programStatus?.replace(/_/g, ' ') ?? null}
            />
          </div>
        </Section>

        {/* Academic record */}
        <Section title="Academic Record">
          <div className="grid grid-cols-3 gap-8 py-4">
            <Stat label="Current GPA" value={ai?.gpa?.toString() ?? '—'} highlight />
            <Stat label="CP Earned" value={ai?.creditUnitsEarned?.toString() ?? '—'} />
            <Stat label="Units Attempted" value={ai?.unitsAttempted?.toString() ?? '—'} />
          </div>
        </Section>
      </div>

      {/* ── Right column ── */}
      <div className="space-y-6">
        {/* Profile health */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold tracking-wider text-gray-600 uppercase">
              Profile Health
            </h3>
            <span
              className={`text-xs font-bold ${isComplete ? 'text-green-500' : 'text-amber-500'}`}
            >
              {isComplete ? '100%' : 'Incomplete'}
            </span>
          </div>
          <div className="mb-6 h-2 w-full rounded-full bg-gray-100">
            <div
              className={`h-2 rounded-full transition-all ${isComplete ? 'w-full bg-red-600' : 'w-1/2 bg-amber-400'}`}
            />
          </div>
          {isComplete ? (
            <div className="flex gap-3 rounded-lg border border-green-100 bg-green-50 p-4">
              <ShieldCheck className="shrink-0 text-green-600" size={20} />
              <div>
                <p className="text-xs font-bold text-green-800">CURRENT STATUS: COMPLETE</p>
                <p className="text-[10px] text-green-700">
                  Your profile is visible to coordinators.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
              <AlertCircle className="shrink-0 text-amber-500" size={20} />
              <div>
                <p className="text-xs font-bold text-amber-800">PROFILE INCOMPLETE</p>
                <p className="text-[10px] text-amber-700">
                  Fill in your academic info to unlock semester selection.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Edit / discard buttons */}
        <button
          onClick={() => setEditing(true)}
          className="w-full rounded-lg bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700"
        >
          EDIT PROFILE
        </button>
      </div>

      {/* Edit form modal */}
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

// ── Small helpers ──────────────────────────────────────────────

function Section({
  title,
  children,
  onEdit,
}: {
  title: string
  children: React.ReactNode
  onEdit?: () => void
}) {
  return (
    <div className="relative pl-6">
      <div className="absolute top-0 bottom-0 left-0 w-0.5 bg-red-600" />
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-bold">{title}</h3>
        {onEdit && (
          <button onClick={onEdit} className="text-xs font-bold text-red-600 hover:underline">
            Edit Info
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="mb-1 text-[10px] font-bold text-gray-400 uppercase">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? '—'}</p>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-4xl font-black ${highlight ? 'text-red-600' : 'text-slate-800'}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold text-gray-400 uppercase">{label}</div>
    </div>
  )
}

function LinkItem({ label }: { label: string }) {
  return (
    <div className="flex cursor-pointer items-center gap-2 text-xs font-bold text-red-600 hover:underline">
      <ExternalLink size={14} />
      <span>{label}</span>
    </div>
  )
}
