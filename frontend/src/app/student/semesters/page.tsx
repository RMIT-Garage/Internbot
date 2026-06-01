'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Sparkles } from 'lucide-react'

import { SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse } from '@/lib/api/openapi-client'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { useAuthContext } from '@/providers/AuthProvider'
import {
  formatSemesterEnrolmentWindow,
  formatSemesterLabel,
  studentSemesterPhaseLabel,
} from '@/lib/semester/display'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'That semester is no longer active.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
}

export default function StudentSemestersPage() {
  const router = useRouter()
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const { refreshProfile } = useAuthContext()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        const [semesterRes, user] = await Promise.all([
          SemestersService.listSemesters(['enrollment_open'], undefined, undefined, 100),
          UsersService.getMyProfile(),
        ])

        setSemesters(semesterRes.items)

        if (user.role === 'student') {
          setSelectedSemester(user.studentProfile?.semesterId ?? null)
        }
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load semesters'))
      } finally {
        setLoading(false)
      }
    }

    void loadData()
  }, [])

  const confirmSelection = async () => {
    if (!selectedSemester) {
      setError('Please select a semester first')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      await UsersService.putMySemesterSelection({ semesterId: selectedSemester })
      await refreshProfile()
      router.push(`/student/opportunities?semesterId=${selectedSemester}`)
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setError(
        (reason && CONFLICT_MESSAGES[reason]) ??
          getApiErrorMessage(err, 'Failed to select semester')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const selected = semesters.find((s) => s.id === selectedSemester) ?? null

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

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SurfaceCard className="overflow-hidden p-0">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-bold text-slate-950">Available semesters</h2>
              <p className="mt-1 text-sm text-slate-500">
                Same offerings coordinators manage — name, course code, and enrollment window.
              </p>
            </div>

            {semesters.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No semesters are open for enrollment right now. Check back later or contact your
                coordinator.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {semesters.map((sem) => {
                  const isSelected = selectedSemester === sem.id
                  return (
                    <button
                      key={sem.id}
                      type="button"
                      onClick={() => setSelectedSemester(sem.id)}
                      className={[
                        'flex w-full items-start gap-4 px-5 py-4 text-left transition',
                        isSelected ? 'bg-red-50/80' : 'hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div
                        className={[
                          'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                          isSelected ? 'border-red-600 bg-red-600' : 'border-slate-300 bg-white',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                            {studentSemesterPhaseLabel(sem.status)}
                          </span>
                        </div>
                        <p className="mt-2 text-base font-bold text-slate-950">{sem.displayName}</p>
                        <p className="mt-0.5 text-sm text-slate-600">
                          {sem.semesterCode} · {sem.courseCode}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                          {formatSemesterEnrolmentWindow(sem)}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </SurfaceCard>
        </div>

        <SurfaceCard className="sticky top-6 p-5 xl:self-start">
          <h3 className="text-base font-bold text-slate-950">Your selection</h3>
          {selected ? (
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">Semester</p>
                <p className="mt-1 font-semibold text-slate-950">{selected.displayName}</p>
                <p className="text-sm text-slate-600">
                  {selected.semesterCode} · {selected.courseCode}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">
                  Enrollment window
                </p>
                <p className="mt-1 text-sm text-slate-700">
                  {formatSemesterEnrolmentWindow(selected)}
                </p>
              </div>
              <p className="text-sm text-slate-500">{formatSemesterLabel(selected)}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select a semester from the list.</p>
          )}

          <button
            type="button"
            onClick={() => void confirmSelection()}
            disabled={submitting || !selectedSemester}
            className="mt-6 w-full rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Saving…' : 'Confirm and continue'}
          </button>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            This sets your active semester for browsing opportunities and applications.
          </p>
        </SurfaceCard>
      </div>
    </div>
  )
}
