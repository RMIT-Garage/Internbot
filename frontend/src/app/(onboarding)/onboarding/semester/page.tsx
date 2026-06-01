'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { SemesterSelectionStep } from '@/features/onboarding/components/SemesterSelectionStep'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OnboardingPageFrame } from '@/features/onboarding/components/OnboardingUi'

function OnboardingLoading() {
  return (
    <OnboardingPageFrame currentStep="semester" maxWidth="xl">
      <CoordinatorPageHeader eyebrow="Profile setup" title="Select your semester" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </OnboardingPageFrame>
  )
}

export default function OnboardingSemesterPage() {
  const { user, loading, error } = useUserProfile()

  if (loading) return <OnboardingLoading />

  if (error) {
    return (
      <OnboardingPageFrame currentStep="semester">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </OnboardingPageFrame>
    )
  }

  if (!user || user.role !== 'student') return null

  return <SemesterSelectionStep user={user as StudentUser} />
}
