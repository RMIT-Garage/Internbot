'use client'

import { useAuth } from '@/hooks/useAuth'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { ProfileView } from '@/features/profile/components/ProfileView'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { StudentUser } from '@/features/profile/types'

export default function ProfilePage() {
  const { ready } = useRequireAuth()
  const { user, loading, error, updateProfile, saving } = useUserProfile()

  if (!ready || loading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    )
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">Profile is only available for students.</p>
      </div>
    )
  }

  return <ProfileView user={user as StudentUser} onSave={updateProfile} saving={saving} />
}
