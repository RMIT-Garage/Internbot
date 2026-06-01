'use client'

import { ReactNode, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { StudentSidebar } from '@/components/student/StudentSidebar'
import { StudentTopbar } from '@/components/student/StudentTopbar'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useAuth } from '@/hooks/useAuth'
import { isCoordinatorRole } from '@/lib/coordinator/auth'
import { SemesterContextBar } from '@/components/student/SemesterContextBar'
import { useStudentSemesterContext } from '@/hooks/useStudentSemesterContext'

export default function StudentLayout({ children }: { children: ReactNode }) {
  const { ready } = useRequireAuth()
  const { profile } = useAuth()
  const router = useRouter()
  const studentSemesterCtx = useStudentSemesterContext({ includeWorkflow: true })

  // Coordinators landing on /student/* get routed back to their own dashboard.
  useEffect(() => {
    if (profile && isCoordinatorRole(profile.role)) {
      router.replace('/coordinator/dashboard')
    }
  }, [profile, router])

  if (!ready || (profile && isCoordinatorRole(profile.role))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" />
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {/* SIDEBAR */}
      <StudentSidebar />

      {/* MAIN COLUMN */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* TOPBAR */}
        <StudentTopbar />

        {/* PAGE CONTENT */}
        <main className="flex-1 overflow-y-auto p-6">
          {profile?.role === 'student' && (
            <SemesterContextBar
              loading={studentSemesterCtx.loading}
              semester={studentSemesterCtx.semester}
              workflow={studentSemesterCtx.workflow}
              canChangeSemester={studentSemesterCtx.canChangeSemester}
              className="mb-6"
            />
          )}
          {children}
        </main>
      </div>
    </div>
  )
}
