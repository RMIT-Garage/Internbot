'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays } from 'lucide-react'
import { SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse } from '@/types/api'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { useAuthContext } from '@/providers/AuthProvider'
import {
  formatSemesterEnrolmentWindow,
  formatSemesterLabel,
  studentSemesterPhaseLabel,
} from '@/lib/semester/display'
import {
  STUDENT_SEMESTER_LIST_STATUSES,
  filterEnrollableSemesters,
} from '@/lib/semester/studentSemesters'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'That semester is no longer active.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
}

export const ONBOARDING_PENDING_SEMESTER_KEY = 'onboarding.pendingSemesterId'

export interface StudentSemesterSelectionProps {
  layout?: 'page' | 'embedded'
  initialSemesterId?: string | null
  confirmLabel?: string
  /**
   * `immediate` calls the semester-selection API on confirm.
   * `deferred` only invokes `onSaved` (for onboarding before profile is complete).
   */
  saveMode?: 'immediate' | 'deferred'
  /** After save, navigate here. Omit to stay on the current page. */
  redirectTo?: string
  onSaved?: (semesterId: string) => void
  readOnly?: boolean
  readOnlyMessage?: string
}

export function StudentSemesterSelection({
  layout = 'embedded',
  initialSemesterId = null,
  confirmLabel = 'Save semester',
  saveMode = 'immediate',
  redirectTo,
  onSaved,
  readOnly = false,
  readOnlyMessage,
}: StudentSemesterSelectionProps) {
  const router = useRouter()
  const { refreshProfile } = useAuthContext()
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [selectedSemester, setSelectedSemester] = useState<string | null>(initialSemesterId)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setSelectedSemester(initialSemesterId)
  }, [initialSemesterId])

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        setLoading(true)
        const [semesterRes, user] = await Promise.all([
          SemestersService.listSemesters(
            [...STUDENT_SEMESTER_LIST_STATUSES],
            undefined,
            undefined,
            100
          ),
          UsersService.getMyProfile(),
        ])
        if (!active) return
        setSemesters(filterEnrollableSemesters(semesterRes.items as SemesterResponse[]))
        if (user.role === 'student' && !initialSemesterId) {
          setSelectedSemester(user.studentProfile?.semesterId ?? null)
        }
      } catch (err: unknown) {
        if (active) setError(getApiErrorMessage(err, 'Failed to load semesters'))
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [initialSemesterId])

  const confirmSelection = async () => {
    if (!selectedSemester) {
      setError('Please select a semester first')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      setSuccess(null)

      if (saveMode === 'immediate') {
        await UsersService.putMySemesterSelection({ semesterId: selectedSemester })
        await refreshProfile()
        setSuccess('Semester saved.')
      }

      onSaved?.(selectedSemester)

      if (redirectTo) {
        router.push(redirectTo)
      }
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setError(
        (reason && CONFLICT_MESSAGES[reason]) ?? getApiErrorMessage(err, 'Failed to save semester')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const selected = semesters.find((s) => s.id === selectedSemester) ?? null

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    )
  }

  if (readOnly) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          Enrolled semester
        </p>
        {selected ? (
          <>
            <p className="mt-2 font-semibold text-slate-950">{formatSemesterLabel(selected)}</p>
            <p className="mt-1 text-sm text-slate-600">
              {selected.semesterCode} · {selected.courseCode}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No semester selected</p>
        )}
        {readOnlyMessage && (
          <p className="mt-3 text-sm leading-6 text-slate-500">{readOnlyMessage}</p>
        )}
      </div>
    )
  }

  const list = (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-bold text-slate-950">Available semesters</h2>
        <p className="mt-1 text-sm text-slate-500">
          Only semesters with open enrollment are listed. Updating your selection overwrites your
          active semester on your profile so you can browse and apply in that term.
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
                  {isSelected && <span className="h-2 w-2 rounded-full bg-white" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                    {studentSemesterPhaseLabel(sem.status)}
                  </span>
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
  )

  const summary = (
    <SurfaceCard className={layout === 'page' ? 'sticky top-6 p-5 xl:self-start' : 'p-5'}>
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
        {submitting ? 'Saving…' : confirmLabel}
      </button>
    </SurfaceCard>
  )

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && !redirectTo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {success}
        </div>
      )}

      {layout === 'page' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>{list}</div>
          {summary}
        </div>
      ) : (
        <div className="space-y-4">
          {list}
          {summary}
        </div>
      )}
    </div>
  )
}
