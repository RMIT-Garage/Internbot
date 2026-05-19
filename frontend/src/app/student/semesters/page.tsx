'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'

import { SemestersService, UsersService } from '@/lib/api/openapi-client'
import type { SemesterResponse } from '@/lib/api/openapi-client'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'

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

  // 1. Load semesters + user profile
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)

        const [semesterRes, user] = await Promise.all([
          SemestersService.listSemesters(['active']),
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

    loadData()
  }, [])

  // 2. Confirm selection
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

  if (loading) {
    return <div className="p-10 text-slate-500">Loading semesters...</div>
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-10">
      <div className="mx-auto grid max-w-6xl grid-cols-12 gap-10">
        {/* LEFT */}
        <div className="col-span-8 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-4xl font-bold text-slate-900">Select Your Semester</h1>
            <p className="mt-2 text-slate-500">
              Choose an active semester to begin your internship workflow.
            </p>
          </div>

          {/* AI hint */}
          <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
            <Sparkles className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">
              Only <b>active semesters</b> are eligible for enrollment.
            </p>
          </div>

          {/* Error / Success */}
          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {success && (
            <div className="rounded-xl bg-green-50 p-3 text-sm text-green-600">{success}</div>
          )}

          {/* Semester List */}
          <div className="grid grid-cols-2 gap-6">
            {semesters.map((sem) => {
              const isSelected = selectedSemester === sem.id

              return (
                <div
                  key={sem.id}
                  onClick={() => setSelectedSemester(sem.id)}
                  className={`cursor-pointer rounded-3xl border p-6 transition ${
                    isSelected
                      ? 'border-red-500 bg-red-50 shadow-lg'
                      : 'border-slate-200 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">
                      {sem.status}
                    </span>

                    <div
                      className={`h-6 w-6 rounded-full border-2 ${
                        isSelected ? 'border-red-500 bg-red-500' : 'border-slate-300'
                      }`}
                    />
                  </div>

                  <h3 className="mt-4 text-xl font-bold text-slate-900">
                    {sem.semesterCode ?? 'Semester'}
                  </h3>

                  <p className="text-sm text-slate-500">{sem.courseCode}</p>

                  {sem.enrolmentOpenAt && (
                    <p className="mt-2 text-xs text-slate-400">
                      Opens: {new Date(sem.enrolmentOpenAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="col-span-4 space-y-6">
          <div className="sticky top-10 rounded-3xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">Selection</h3>

            <p className="mt-4 text-sm text-slate-500">Selected Semester:</p>

            <p className="font-semibold text-slate-900">
              {semesters.find((s) => s.id === selectedSemester)?.semesterCode ?? 'None selected'}
            </p>

            <button
              onClick={confirmSelection}
              disabled={submitting}
              className="mt-6 w-full rounded-2xl bg-red-600 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Confirm Selection'}
            </button>

            <p className="mt-3 text-[11px] text-slate-400">
              This will lock your semester selection.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
