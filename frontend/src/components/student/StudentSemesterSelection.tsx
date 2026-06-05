'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronRight, X } from 'lucide-react'
import { SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse } from '@/types/api'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'
import { SurfaceCard } from '@/components/student/Premium'
import { useAuthContext } from '@/providers/AuthProvider'
import { formatSemesterLabel } from '@/lib/semester/display'
import {
  STUDENT_SEMESTER_LIST_STATUSES,
  canStudentSelectSemester,
  filterSelectableSemesters,
} from '@/lib/semester/studentSemesters'
import {
  EnrolledSemesterCard,
  SemesterPickerGrid,
  SemesterPickerGridSkeleton,
} from '@/components/student/SemesterPickerGrid'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'That semester is no longer active.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
}

export const ONBOARDING_PENDING_SEMESTER_KEY = 'onboarding.pendingSemesterId'

export interface StudentSemesterSelectionProps {
  layout?: 'page' | 'embedded'
  presentation?: 'inline' | 'modal'
  semesterListMode?: 'enrollable-only' | 'all-listed'
  initialSemesterId?: string | null
  confirmLabel?: string
  changeSemesterLabel?: string
  saveMode?: 'immediate' | 'deferred'
  redirectTo?: string
  onSaved?: (semesterId: string) => void
  readOnly?: boolean
  readOnlyMessage?: string
}

export function StudentSemesterSelection({
  layout = 'embedded',
  presentation = 'inline',
  semesterListMode = 'enrollable-only',
  initialSemesterId = null,
  confirmLabel = 'Save semester',
  changeSemesterLabel = 'Change semester',
  saveMode = 'immediate',
  redirectTo,
  onSaved,
  readOnly = false,
  readOnlyMessage,
}: StudentSemesterSelectionProps) {
  const router = useRouter()
  const { refreshProfile } = useAuthContext()
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [currentSemester, setCurrentSemester] = useState<SemesterResponse | null>(null)
  const [selectedSemester, setSelectedSemester] = useState<string | null>(initialSemesterId)
  const [loading, setLoading] = useState(presentation === 'inline')
  const [loadingCurrent, setLoadingCurrent] = useState(presentation === 'modal')
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    setSelectedSemester(initialSemesterId)
  }, [initialSemesterId])

  useEffect(() => {
    if (presentation !== 'modal') return
    if (!initialSemesterId) {
      setCurrentSemester(null)
      setLoadingCurrent(false)
      return
    }
    let active = true
    setLoadingCurrent(true)
    void SemestersService.getSemester(initialSemesterId)
      .then((sem) => {
        if (active) setCurrentSemester(sem as SemesterResponse)
      })
      .catch(() => {
        if (active) setCurrentSemester(null)
      })
      .finally(() => {
        if (active) setLoadingCurrent(false)
      })
    return () => {
      active = false
    }
  }, [presentation, initialSemesterId])

  useEffect(() => {
    const shouldLoadList = presentation === 'inline' || modalOpen
    if (!shouldLoadList) return

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
        const items = semesterRes.items as SemesterResponse[]
        setSemesters(
          semesterListMode === 'enrollable-only' ? filterSelectableSemesters(items) : items
        )
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
  }, [presentation, modalOpen, initialSemesterId, semesterListMode])

  const openModal = () => {
    setError(null)
    setSuccess(null)
    setSelectedSemester(initialSemesterId ?? currentSemester?.id ?? null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setSelectedSemester(initialSemesterId)
    setError(null)
  }

  const confirmSelection = async () => {
    if (!selectedSemester) {
      setError('Please select a semester first')
      return
    }

    const selected = semesters.find((s) => s.id === selectedSemester)
    if (selected && !canStudentSelectSemester(selected)) {
      setError('That semester is not open for enrollment.')
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
        if (presentation === 'modal' && selected) {
          setCurrentSemester(selected)
        }
      }

      onSaved?.(selectedSemester)

      if (redirectTo) {
        router.push(redirectTo)
        return
      }

      if (presentation === 'modal') {
        setModalOpen(false)
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
  const selectedSelectable = selected ? canStudentSelectSemester(selected) : false
  const selectedSem = semesters.find((s) => s.id === selectedSemester)
  const showNonSelectableHint =
    semesterListMode === 'all-listed' && selectedSem != null && !selectedSelectable

  if (readOnly) {
    const display = currentSemester ?? selected
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          Enrolled semester
        </p>
        {display ? (
          <>
            <p className="mt-2 font-semibold text-slate-950">{formatSemesterLabel(display)}</p>
            <p className="mt-1 text-sm text-slate-600">
              {display.semesterCode} · {display.courseCode}
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

  if (presentation === 'modal') {
    return (
      <div className="space-y-4">
        {error && !modalOpen && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && !modalOpen && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {success}
          </div>
        )}

        <EnrolledSemesterCard
          semester={currentSemester}
          loading={loadingCurrent}
          changeLabel={changeSemesterLabel}
          onChange={openModal}
        />

        {modalOpen && (
          <SemesterChangeModal
            error={error}
            loading={loading}
            semesters={semesters}
            selectedSemesterId={selectedSemester}
            semesterListMode={semesterListMode}
            confirmLabel={confirmLabel}
            submitting={submitting}
            selectedSelectable={selectedSelectable}
            showNonSelectableHint={showNonSelectableHint}
            onSelect={setSelectedSemester}
            onClose={closeModal}
            onConfirm={() => void confirmSelection()}
          />
        )}
      </div>
    )
  }

  const pickerIntro =
    semesterListMode === 'all-listed' ? (
      <p className="text-sm leading-6 text-gray-500">
        Any semester with enrollment open can be selected. Placement or reporting phases cannot be
        chosen.
      </p>
    ) : (
      <p className="text-sm leading-6 text-gray-500">
        Only semesters with open enrollment are listed. Your selection sets the active semester on
        your profile for browsing and applying.
      </p>
    )

  const grid = loading ? (
    <SemesterPickerGridSkeleton count={layout === 'page' ? 3 : 2} />
  ) : (
    <SemesterPickerGrid
      semesters={semesters}
      selectedSemesterId={selectedSemester}
      onSelect={setSelectedSemester}
      allowClosedWindowSelection
      columns={layout === 'page' ? 'three' : 'two'}
    />
  )

  const summary = (
    <SurfaceCard className={layout === 'page' ? 'sticky top-6 p-5 xl:self-start' : 'p-5'}>
      <h3 className="text-base font-bold text-gray-900">Your selection</h3>
      {selected ? (
        <div className="mt-4 space-y-2">
          <p className="text-lg font-bold text-gray-900">{selected.displayName}</p>
          <p className="text-sm text-gray-500">
            {selected.semesterCode} · {selected.courseCode}
          </p>
          <p className="text-sm text-gray-500">{formatSemesterLabel(selected)}</p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500">Select a semester to continue.</p>
      )}

      {showNonSelectableHint && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          This semester is not in the enrollment phase. Pick a semester with enrollment open.
        </div>
      )}

      <button
        type="button"
        onClick={() => void confirmSelection()}
        disabled={submitting || !selectedSemester || !selectedSelectable}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? 'Saving…' : confirmLabel}
        {!submitting && <ChevronRight className="h-4 w-4" />}
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

      {pickerIntro}

      {layout === 'page' ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div>{grid}</div>
          {!loading && summary}
        </div>
      ) : (
        <div className="space-y-4">
          {grid}
          {!loading && summary}
        </div>
      )}
    </div>
  )
}

function SemesterChangeModal({
  error,
  loading,
  semesters,
  selectedSemesterId,
  semesterListMode,
  confirmLabel,
  submitting,
  selectedSelectable,
  showNonSelectableHint,
  onSelect,
  onClose,
  onConfirm,
}: {
  error: string | null
  loading: boolean
  semesters: SemesterResponse[]
  selectedSemesterId: string | null
  semesterListMode: 'enrollable-only' | 'all-listed'
  confirmLabel: string
  submitting: boolean
  selectedSelectable: boolean
  showNonSelectableHint: boolean
  onSelect: (id: string) => void
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <SurfaceCard className="relative z-10 flex max-h-[min(92vh,800px)] w-full max-w-4xl flex-col overflow-hidden shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">Enrollment</p>
            <h2 className="mt-1 text-xl font-bold text-gray-900">Change semester</h2>
            <p className="mt-1 max-w-xl text-sm text-gray-500">
              Choose where you want to browse and apply. Existing applications stay on the semester
              you applied in.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-gray-400 transition hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {semesterListMode === 'all-listed' && (
            <p className="mb-4 text-sm text-gray-500">
              Semesters in placement or reporting cannot be selected. Enrolment dates are shown for
              reference; you can still select enrollment-open semesters after their window ends.
            </p>
          )}
          {loading ? (
            <SemesterPickerGridSkeleton count={3} />
          ) : (
            <SemesterPickerGrid
              semesters={semesters}
              selectedSemesterId={selectedSemesterId}
              onSelect={onSelect}
              allowClosedWindowSelection
              columns="three"
            />
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 px-6 py-5">
          {showNonSelectableHint && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              This semester is not in the enrollment phase. Choose a semester with enrollment open.
            </div>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={submitting || !selectedSemesterId || !selectedSelectable || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Saving…' : confirmLabel}
              {!submitting && <ChevronRight className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  )
}
