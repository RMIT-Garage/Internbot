'use client'

import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { AcademicProfileStep } from '@/features/onboarding/components/AcademicProfileStep'
import { OnboardingSidebar } from '@/features/onboarding/components/OnboardingSidebar'
import type { StudentUser } from '@/features/profile/types'

export default function OnboardingAcademicPage() {
  const { user, error, updateProfile, saving } = useUserProfile()

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
      <OnboardingSidebar currentStep="academic" />
      <AcademicProfileStep user={user as StudentUser} onSave={updateProfile} saving={saving} />
    </>
  )
}
