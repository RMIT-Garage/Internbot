'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { CourseCreditsStep } from '@/features/onboarding/components/CourseCreditsStep'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OnboardingPageFrame } from '@/features/onboarding/components/OnboardingUi'

function OnboardingLoading() {
  return (
    <OnboardingPageFrame currentStep="credits" maxWidth="xl">
      <CoordinatorPageHeader eyebrow="Profile setup" title="Prerequisites & credits" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <SurfaceCard key={i} className="h-32 p-5">
            <Skeleton className="h-4 w-24" />
          </SurfaceCard>
        ))}
      </div>
    </OnboardingPageFrame>
  )
}

export default function OnboardingCreditsPage() {
  const { user, loading, error } = useUserProfile()

  if (loading) return <OnboardingLoading />

  if (error) {
    return (
      <OnboardingPageFrame currentStep="credits">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </OnboardingPageFrame>
    )
  }

  if (!user || user.role !== 'student') return null

  return <CourseCreditsStep user={user as StudentUser} />
}
