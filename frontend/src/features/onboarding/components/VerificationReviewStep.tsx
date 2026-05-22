'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ShieldCheck, PencilLine, CheckCircle2, Bell, UserCircle } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload } from '@/features/profile/types'
import { Navbar } from '@/components/layout/Navbar'

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

const STEPS = [
  { key: 'personal', label: 'Identity', number: '1' },
  { key: 'academic', label: 'Academic', number: '2' },
  { key: 'credits', label: 'Credits', number: '3' },
  { key: 'review', label: 'Finalize', number: '4' },
] as const

export function VerificationReviewStep({ user, onSave, saving }: Props) {
  const router = useRouter()
  const [isConfirmed, setIsConfirmed] = useState(false)

  const { displayName, email, studentProfile } = user
  const ai = studentProfile.academicInfo

  const missingFields = [
    !displayName ? 'Display name' : null,
    !studentProfile.phone ? 'Phone number' : null,
    !studentProfile.semesterId ? 'Semester selection' : null,
    !studentProfile.academicInfo ? 'Academic information' : null,
  ].filter((field): field is string => Boolean(field))

  const handleFinalSubmit = async () => {
    if (!isConfirmed) {
      toast.error('Please confirm the data integrity checkbox.')
      return
    }

    if (!ai) {
      toast.error('Academic information is missing. Please complete the previous steps.')
      return
    }

    try {
      // Finalise the profile by re-submitting academicInfo with all required fields.
      // The backend transitions onboardingStage → 'profile_complete' once all fields
      // are present and the payload is accepted (see PATCH /api/v1/users/me).
      await onSave({
        studentProfile: {
          phone: studentProfile.phone ?? undefined,
          academicInfo: {
            programName: ai.programName,
            programLevel: ai.programLevel,
            programStatus: ai.programStatus,
            majors: ai.majors,
            minors: ai.minors,
            unitsAttempted: ai.unitsAttempted,
            creditUnitsEarned: ai.creditUnitsEarned,
            gpa: ai.gpa,
            currentStudyLoad: ai.currentStudyLoad,
            notes: ai.notes,
          },
        },
      })
      toast.success('Profile completed successfully!')
      router.push('/student/dashboard')
    } catch {
      toast.error('Submission failed. Please try again.')
    }
  }

  return (
    <main className="flex-1 bg-[#F9FAFB]">
      <Navbar />

      <div className="mx-auto max-w-5xl p-8 lg:p-12">
        {/* Stepper */}
        <div className="relative mb-16 flex items-center justify-center">
          <div className="absolute top-5 left-0 -z-10 h-px w-full bg-gray-100" />

          <div className="flex w-full max-w-2xl justify-between">
            {STEPS.map((step) => {
              const isActive = step.key === 'review'

              const isCompleted =
                step.key === 'personal' || step.key === 'academic' || step.key === 'credits'

              let circleClass =
                'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-white border-2 border-gray-100 text-gray-300'

              let labelClass = 'text-[10px] tracking-widest uppercase text-gray-300'

              if (isActive) {
                circleClass =
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-red-700 border-2 border-red-700 text-white scale-110 shadow-lg shadow-red-100'

                labelClass = 'text-[10px] tracking-widest uppercase text-red-700 font-bold'
              } else if (isCompleted) {
                circleClass =
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10 bg-slate-800 border-2 border-slate-800 text-white'

                labelClass = 'text-[10px] tracking-widest uppercase text-slate-800 font-bold'
              }

              return (
                <div key={step.key} className="flex flex-col items-center gap-3">
                  <div className={circleClass}>{step.number}</div>

                  <span className={labelClass}>{step.label}</span>
                </div>
              )
            })}
          </div>
        </div>
        {/* Header */}
        <div className="mb-10 flex items-start justify-between">
          <div>
            <h1 className="mb-2 text-4xl font-bold">Verification & Review</h1>
            <p className="max-w-lg leading-relaxed text-slate-500">
              Please perform a final audit of your academic digital twin. Ensure all credentials
              align with your official documentation.
            </p>
          </div>
        </div>

        {missingFields.length > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-5 w-5 text-amber-600" />

              <div className="flex-1">
                <h3 className="text-sm font-bold text-amber-900">
                  Your profile is still incomplete
                </h3>

                <p className="mt-1 text-sm text-amber-700">
                  Complete the following fields before finishing onboarding:
                </p>

                <ul className="mt-3 space-y-1 text-sm text-amber-800">
                  {missingFields.map((field) => (
                    <li key={field} className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {field}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Data cards */}
        <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Personal card */}
          <ReviewCard title="Personal Details" onEdit={() => router.push('/onboarding/personal')}>
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-xl bg-slate-200">
                <UserCircle size={40} className="text-slate-400" />
              </div>
              <h3 className="text-lg font-bold">{displayName ?? '—'}</h3>
              <p className="text-xs font-medium text-gray-400">
                ID: {studentProfile.studentNumber}
              </p>
            </div>
            <div className="space-y-3 border-t border-gray-50 pt-4">
              <DetailRow label="Email" value={email} />
              <DetailRow label="Phone" value={studentProfile.phone ?? '—'} />
              <DetailRow label="Program Code" value={studentProfile.programCode ?? '—'} />
            </div>
          </ReviewCard>

          {/* Academic card */}
          <ReviewCard title="Academic Profile" onEdit={() => router.push('/onboarding/academic')}>
            {ai ? (
              <>
                <div className="grid grid-cols-2 gap-6 pt-2">
                  <DetailBlock label="Program" value={ai.programName} />
                  <DetailBlock
                    label="Level"
                    value={ai.programLevel.charAt(0).toUpperCase() + ai.programLevel.slice(1)}
                  />
                  <DetailBlock label="GPA" value={`${ai.gpa} / 4.0`} />
                  <DetailBlock label="Study Load" value={ai.currentStudyLoad.replace('_', ' ')} />
                </div>
              </>
            ) : (
              <p className="text-sm text-red-500">
                Academic info incomplete —{' '}
                <button onClick={() => router.push('/onboarding/academic')} className="underline">
                  go back and fill it in
                </button>
                .
              </p>
            )}
          </ReviewCard>
        </div>

        {/* Credits summary card */}
        <ReviewCard
          title="Course Credits & Recognition"
          onEdit={() => router.push('/onboarding/credits')}
        >
          <div className="mt-4 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 text-[10px] font-bold text-gray-400 uppercase">
                  <th className="pb-3 text-left">Metric</th>
                  <th className="pb-3 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="text-xs font-medium text-slate-700">
                <tr className="border-b border-gray-50">
                  <td className="py-4 font-bold">Units Attempted</td>
                  <td className="py-4 text-right text-gray-400">{ai?.unitsAttempted ?? '—'}</td>
                </tr>
                <tr className="border-b border-gray-50">
                  <td className="py-4 font-bold">Credit Units Earned</td>
                  <td className="py-4 text-right text-gray-400">{ai?.creditUnitsEarned ?? '—'}</td>
                </tr>
                {ai?.majors && ai.majors.length > 0 && (
                  <tr className="border-b border-gray-50">
                    <td className="py-4 font-bold">Majors</td>
                    <td className="py-4 text-right text-gray-400">{ai.majors.join(', ')}</td>
                  </tr>
                )}
                {ai?.minors && ai.minors.length > 0 && (
                  <tr className="border-b border-gray-50 last:border-0">
                    <td className="py-4 font-bold">Minors</td>
                    <td className="py-4 text-right text-gray-400">{ai.minors.join(', ')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </ReviewCard>

        {/* Submission footer */}
        <div className="mt-8 flex flex-col items-center gap-6 rounded-2xl border border-gray-100 bg-white p-8 shadow-sm md:flex-row">
          <div className="flex gap-4">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-1 h-5 w-5 cursor-pointer rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <p className="text-xs leading-relaxed text-slate-500">
              I confirm these records are a precise digital twin of my academic journey. I
              understand that falsification leads to disciplinary action under the RMIT Academic
              Integrity Policy.
            </p>
          </div>
          <div className="flex w-full shrink-0 gap-3 md:w-auto">
            <button
              onClick={() => router.push('/onboarding/credits')}
              className="flex-1 rounded-xl border py-3 text-xs font-bold text-gray-400 transition hover:bg-gray-50 md:px-6"
            >
              Back
            </button>
            <button
              onClick={handleFinalSubmit}
              disabled={saving || !isConfirmed || missingFields.length > 0}
              className="flex-1 rounded-xl bg-[#B91C1C] px-10 py-3 text-xs font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 md:flex-none"
            >
              {saving
                ? 'Submitting…'
                : missingFields.length > 0
                  ? 'Complete Missing Fields'
                  : 'Complete Profile'}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}

// ── Helper UI components ──────────────────────────────────────

function ReviewCard({
  title,
  children,
  onEdit,
}: {
  title: string
  children: React.ReactNode
  onEdit: () => void
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <span className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold tracking-wider text-gray-500 uppercase">
          {title}
        </span>
        <button
          onClick={onEdit}
          className="flex items-center gap-1 text-[10px] font-black text-red-600 uppercase hover:underline"
        >
          <PencilLine size={12} /> Edit
        </button>
      </div>
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="font-medium text-gray-400">{label}</span>
      <span className="font-bold text-slate-800">{value}</span>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[9px] font-bold tracking-widest text-gray-400 uppercase">{label}</p>
      <p className="text-xs leading-tight font-bold">{value}</p>
    </div>
  )
}
