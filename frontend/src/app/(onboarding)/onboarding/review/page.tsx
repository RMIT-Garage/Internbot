'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { VerificationReviewStep } from '@/features/onboarding/components/VerificationReviewStep'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OnboardingPageFrame } from '@/features/onboarding/components/OnboardingUi'

function OnboardingLoading() {
  return (
    <OnboardingPageFrame currentStep="review" maxWidth="xl">
      <CoordinatorPageHeader eyebrow="Profile setup" title="Verification & review" />
      <div className="grid gap-4 md:grid-cols-2">
        <SurfaceCard className="h-48 p-5">
          <Skeleton className="h-full w-full rounded-xl" />
        </SurfaceCard>
        <SurfaceCard className="h-48 p-5">
          <Skeleton className="h-full w-full rounded-xl" />
        </SurfaceCard>
      </div>
    </OnboardingPageFrame>
  )
}

export default function OnboardingReviewPage() {
  const { user, loading, error, updateProfile, saving } = useUserProfile()

  if (loading) return <OnboardingLoading />

  if (error) {
    return (
      <OnboardingPageFrame currentStep="review">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </OnboardingPageFrame>
    )
  }

  if (!user || user.role !== 'student') return null

  return (
    <VerificationReviewStep user={user as StudentUser} onSave={updateProfile} saving={saving} />
  )
}
