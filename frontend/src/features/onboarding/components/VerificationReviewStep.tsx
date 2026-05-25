'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { PencilLine, UserCircle2 } from 'lucide-react'
import type { StudentUser, UpdateProfilePayload } from '@/features/profile/types'
import { SurfaceCard } from '@/components/student/Premium'
import {
  OnboardingAlert,
  OnboardingPageFrame,
  OnboardingStepHeader,
  OnboardingStepper,
} from './OnboardingUi'

interface Props {
  user: StudentUser
  onSave: (payload: UpdateProfilePayload) => Promise<void>
  saving: boolean
}

export function VerificationReviewStep({ user, onSave, saving }: Props) {
  const router = useRouter()
  const [isConfirmed, setIsConfirmed] = useState(false)

  const { displayName, email, studentProfile } = user
  const ai = studentProfile.academicInfo

  const missingFields = [
    !displayName ? 'Student name' : null,
    !studentProfile.phone ? 'Phone number' : null,
    !studentProfile.semesterId ? 'Semester selection' : null,
    !studentProfile.academicInfo ? 'Academic information' : null,
  ].filter((field): field is string => Boolean(field))

  const handleFinalSubmit = async () => {
    if (!displayName) {
      toast.error('Student name is required. Please go back and fill in your name.')
      return
    }

    if (!isConfirmed) {
      toast.error('Please confirm the data integrity checkbox.')
      return
    }

    if (!ai) {
      toast.error('Academic information is missing. Please complete the previous steps.')
      return
    }

    try {
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
    <OnboardingPageFrame currentStep="review" maxWidth="xl">
      <OnboardingStepper currentStep="review" />
      <OnboardingStepHeader
        eyebrow="Step 4 — Review"
        title="Verification & review"
        description="Review your details before submitting. Ensure everything matches your official RMIT records."
      />

      {missingFields.length > 0 && (
        <OnboardingAlert variant="warning" title="Your profile is still incomplete">
          <ul className="mt-2 list-inside list-disc space-y-1">
            {missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </OnboardingAlert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <ReviewCard title="Personal details" onEdit={() => router.push('/onboarding/personal')}>
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
              <UserCircle2 className="h-8 w-8 text-red-700" aria-hidden />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-950">{displayName ?? '—'}</h3>
              <p className="text-xs font-medium text-slate-500">
                ID: {studentProfile.studentNumber}
              </p>
            </div>
          </div>
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <DetailRow label="Email" value={email} />
            <DetailRow label="Phone" value={studentProfile.phone ?? '—'} />
            <DetailRow label="Program code" value={studentProfile.programCode ?? '—'} />
          </div>
        </ReviewCard>

        <ReviewCard title="Academic profile" onEdit={() => router.push('/onboarding/academic')}>
          {ai ? (
            <div className="grid grid-cols-2 gap-4 pt-1">
              <DetailBlock label="Program" value={ai.programName} />
              <DetailBlock
                label="Level"
                value={ai.programLevel.charAt(0).toUpperCase() + ai.programLevel.slice(1)}
              />
              <DetailBlock label="GPA" value={`${ai.gpa} / 4.0`} />
              <DetailBlock label="Study load" value={ai.currentStudyLoad.replace(/_/g, ' ')} />
            </div>
          ) : (
            <p className="text-sm text-red-600">
              Academic info incomplete —{' '}
              <button
                type="button"
                onClick={() => router.push('/onboarding/academic')}
                className="font-bold underline"
              >
                go back and fill it in
              </button>
              .
            </p>
          )}
        </ReviewCard>
      </div>

      <ReviewCard title="Course credits" onEdit={() => router.push('/onboarding/credits')}>
        <div className="divide-y divide-slate-100">
          <DetailRow label="Units attempted" value={String(ai?.unitsAttempted ?? '—')} />
          <DetailRow label="Credit points earned" value={String(ai?.creditUnitsEarned ?? '—')} />
          {ai?.majors && ai.majors.length > 0 && (
            <DetailRow label="Majors" value={ai.majors.join(', ')} />
          )}
          {ai?.minors && ai.minors.length > 0 && (
            <DetailRow label="Minors" value={ai.minors.join(', ')} />
          )}
        </div>
      </ReviewCard>

      <SurfaceCard className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={isConfirmed}
              onChange={(e) => setIsConfirmed(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300 text-red-700 focus:ring-red-500"
            />
            <span className="text-sm leading-6 text-slate-600">
              I confirm these records are accurate and match my official RMIT academic
              documentation. I understand that falsification may lead to disciplinary action under
              the RMIT Academic Integrity Policy.
            </span>
          </label>
          <div className="flex shrink-0 gap-3">
            <button
              type="button"
              onClick={() => router.push('/onboarding/credits')}
              className="h-11 rounded-xl border border-slate-200 px-6 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={saving || !isConfirmed}
              className="h-11 rounded-xl bg-red-700 px-8 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? 'Submitting…'
                : missingFields.length > 0
                  ? 'Complete missing fields'
                  : 'Complete profile'}
            </button>
          </div>
        </div>
      </SurfaceCard>
    </OnboardingPageFrame>
  )
}

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
    <SurfaceCard className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-950">{title}</h3>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800"
        >
          <PencilLine className="h-3.5 w-3.5" aria-hidden />
          Edit
        </button>
      </div>
      {children}
    </SurfaceCard>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-sm first:pt-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="font-bold text-slate-950">{value}</span>
    </div>
  )
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-sm font-bold text-slate-950">{value}</p>
    </div>
  )
}
