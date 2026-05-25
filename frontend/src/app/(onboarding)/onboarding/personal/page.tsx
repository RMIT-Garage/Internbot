'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { PersonalDetailsStep } from '@/features/onboarding/components/PersonalDetailsStep'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OnboardingPageFrame } from '@/features/onboarding/components/OnboardingUi'

function OnboardingLoading() {
  return (
    <OnboardingPageFrame currentStep="personal">
      <CoordinatorPageHeader eyebrow="Profile setup" title="Personal details" />
      <SurfaceCard className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      </SurfaceCard>
    </OnboardingPageFrame>
  )
}

export default function OnboardingPersonalPage() {
  const { user, loading, error, updateProfile, saving } = useUserProfile()

  if (loading) return <OnboardingLoading />

  if (error) {
    return (
      <OnboardingPageFrame currentStep="personal">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </OnboardingPageFrame>
    )
  }

  if (!user || user.role !== 'student') return null

  return <PersonalDetailsStep user={user as StudentUser} onSave={updateProfile} saving={saving} />
}
