'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { UsersService } from '@/lib/api/openapi-client'
import { CoordinatorPageHeader } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { StudentSemesterSelection } from '@/components/student/StudentSemesterSelection'

export default function StudentSemestersPage() {
  const router = useRouter()
  const [semesterId, setSemesterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const user = await UsersService.getMyProfile()
        if (!active) return
        if (user.role === 'student') {
          setSemesterId(user.studentProfile?.semesterId ?? null)
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading semesters…</span>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-14 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Enrollment"
        title="Select your semester"
        description="Choose the teaching period and course offering you are enrolling in for internship credit. Only semesters with open enrollment are listed."
      />

      <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
        <p className="text-sm leading-6 text-red-800">
          Pick the semester that matches your program intake. You will browse opportunities and
          submit applications for this semester only.
        </p>
      </div>

      <StudentSemesterSelection
        layout="page"
        initialSemesterId={semesterId}
        confirmLabel="Confirm and continue"
        onSaved={(id) => {
          setSemesterId(id)
          router.push(`/student/opportunities?semesterId=${id}`)
        }}
      />
    </div>
  )
}
