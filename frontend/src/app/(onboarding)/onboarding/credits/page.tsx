'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { CourseCreditsStep } from '@/features/onboarding/components/CourseCreditsStep'
import { OnboardingSidebar } from '@/features/onboarding/components/OnboardingSidebar'
import type { StudentUser } from '@/features/profile/types'

export default function OnboardingCreditsPage() {
  const { user, error } = useUserProfile()

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
