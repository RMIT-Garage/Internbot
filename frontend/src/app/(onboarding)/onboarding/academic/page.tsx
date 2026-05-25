'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { AcademicProfileStep } from '@/features/onboarding/components/AcademicProfileStep'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OnboardingPageFrame } from '@/features/onboarding/components/OnboardingUi'

function OnboardingLoading() {
  return (
    <OnboardingPageFrame currentStep="academic">
      <CoordinatorPageHeader eyebrow="Profile setup" title="Academic information" />
      <SurfaceCard className="p-6">
        <Skeleton className="h-10 w-full rounded-xl" />
      </SurfaceCard>
    </OnboardingPageFrame>
  )
}

export default function OnboardingAcademicPage() {
  const { user, loading, error, updateProfile, saving } = useUserProfile()

  if (loading) return <OnboardingLoading />

  if (error) {
    return (
      <OnboardingPageFrame currentStep="academic">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </OnboardingPageFrame>
    )
  }

  if (!user || user.role !== 'student') return null

  return <AcademicProfileStep user={user as StudentUser} onSave={updateProfile} saving={saving} />
}
