'use client'

import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useUserProfile } from '@/features/profile/hooks/useUserProfile'
import { ProfileView } from '@/features/profile/components/ProfileView'
import type { StudentUser } from '@/features/profile/types'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'

function ProfileLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading profile…</span>
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="Profile"
        description="Your personal details, academic program, and placement readiness."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SurfaceCard className="p-6">
            <div className="flex gap-6">
              <Skeleton className="h-20 w-20 shrink-0 rounded-2xl" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-7 w-48 bg-slate-200" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
          </SurfaceCard>
          {[0, 1, 2].map((i) => (
            <SurfaceCard key={i} className="p-5">
              <Skeleton className="h-4 w-32 bg-slate-200" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-16 w-full rounded-xl" />
              </div>
            </SurfaceCard>
          ))}
        </div>
        <SurfaceCard className="p-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-2 w-full rounded-full" />
          <Skeleton className="mt-5 h-20 w-full rounded-xl" />
        </SurfaceCard>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { ready } = useRequireAuth()
  const { user, loading, error, updateProfile, saving } = useUserProfile()

  if (!ready || loading) {
    return <ProfileLoadingSkeleton />
  }

  if (error) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Student Hub"
          title="Profile"
          description="Your personal details, academic program, and placement readiness."
        />
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'student') {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader eyebrow="Student Hub" title="Profile" />
        <SurfaceCard className="p-8 text-center text-sm text-slate-500">
          Profile is only available for students.
        </SurfaceCard>
      </div>
    )
  }

  return <ProfileView user={user as StudentUser} onSave={updateProfile} saving={saving} />
}
