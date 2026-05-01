'use client'

import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { CourseCreditsStep } from '@/features/onboarding/components/CourseCreditsStep'
import { OnboardingSidebar } from '@/features/onboarding/components/OnboardingSidebar'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { StudentUser } from '@/features/profile/types'

export default function OnboardingCreditsPage() {
  const { ready } = useRequireAuth()
  const { user, loading, error } = useUserProfile()

  if (!ready || loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!user || user.role !== 'student') return null

  return (
    <>
      <OnboardingSidebar currentStep="credits" />
      <CourseCreditsStep user={user as StudentUser} />
    </>
  )
}
