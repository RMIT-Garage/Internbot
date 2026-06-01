'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { StudentUser } from '@/features/profile/types'
import {
  ONBOARDING_PENDING_SEMESTER_KEY,
  StudentSemesterSelection,
} from '@/components/student/StudentSemesterSelection'
import { OnboardingPageFrame, OnboardingStepHeader, OnboardingStepper } from './OnboardingUi'

interface Props {
  user: StudentUser
}

function resolveInitialSemesterId(savedSemesterId: string | null): string | null {
  if (savedSemesterId) return savedSemesterId
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ONBOARDING_PENDING_SEMESTER_KEY)
}

export function SemesterSelectionStep({ user }: Props) {
  const router = useRouter()
  const savedSemesterId = user.studentProfile.semesterId ?? null
  const initialSemesterId = resolveInitialSemesterId(savedSemesterId)

  return (
    <OnboardingPageFrame currentStep="semester" maxWidth="xl">
      <OnboardingStepper currentStep="semester" />
      <OnboardingStepHeader
        eyebrow="Step 4 — Semester"
        title="Select your semester"
        description="Choose the teaching period you are enrolling in for internship credit. This is saved on your student profile and you can change it later to apply in another semester."
      />

      <StudentSemesterSelection
        layout="embedded"
        initialSemesterId={initialSemesterId}
        saveMode="deferred"
        confirmLabel="Continue to review"
        onSaved={(id) => {
          sessionStorage.setItem(ONBOARDING_PENDING_SEMESTER_KEY, id)
          router.push('/onboarding/review')
        }}
      />

      <button
        type="button"
        onClick={() => router.push('/onboarding/credits')}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to credits
      </button>
    </OnboardingPageFrame>
  )
}
