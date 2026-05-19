'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, BriefcaseBusiness, CalendarDays, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/student/Premium'

import { StatusBadge, type CoordinatorStatus } from '@/components/student/StatusBadge'
import {
  OpportunitiesService,
  InternshipsService,
  SemestersService,
  UsersService,
} from '@/lib/api/openapi-client'
import type {
  OpportunityResponse,
  InternshipListItemResponse,
  SemesterResponse,
} from '@/lib/api/openapi-client'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'That semester is no longer active.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
}

function opportunityStatusToBadge(status: string): CoordinatorStatus {
  const map: Record<string, CoordinatorStatus> = {
    published: 'active',
    draft: 'pending',
    pending_verification: 'on_track',
    rejected: 'rejected',
    archived: 'archived',
  }
  return map[status] ?? 'pending'
}

export default function StudentOpportunitiesPage() {
  const { user } = useAuth()

  // Confirmed semester lives in state — resets to null on every page refresh,
  // which brings the user back to the semester selection screen.
  const [confirmedSemesterId, setConfirmedSemesterId] = useState<string | null>(null)

  // Semester selection state
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null)
  const [loadingSemesters, setLoadingSemesters] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [semesterError, setSemesterError] = useState<string | null>(null)

  // Opportunities state
  const [opportunities, setOpportunities] = useState<OpportunityResponse[]>([])
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load semesters + pre-select the user's current semester.
  // Gated on `user` so it only runs after Firebase Auth has initialized —
  // otherwise OpenAPI.TOKEN returns '' and the API calls get a silent 401.
  useEffect(() => {
    if (!user) return
    let active = true

    const load = async () => {
      setLoadingSemesters(true)
      // Use allSettled so a profile error never blocks semester loading
      const [semRes, profileRes] = await Promise.allSettled([
        SemestersService.listSemesters(['active']),
        UsersService.getMyProfile(),
      ])
      if (!active) return
      if (semRes.status === 'fulfilled') {
        setSemesters(semRes.value.items)
      }
      if (profileRes.status === 'fulfilled' && profileRes.value.role === 'student') {
        setSelectedSemester(profileRes.value.studentProfile?.semesterId ?? null)
      }
      setLoadingSemesters(false)
    }

    load()
    return () => {
      active = false
    }
  }, [user])

  // Load opportunities once the semester is confirmed
  useEffect(() => {
    if (!confirmedSemesterId) return
    const loadData = async () => {
      try {
        setLoading(true)
        const [oppRes, intRes] = await Promise.all([
          OpportunitiesService.listOpportunities(confirmedSemesterId),
          InternshipsService.listInternships(),
        ])
        setOpportunities(oppRes.items)
        setInternships(intRes.items)
      } catch (err: any) {
        setError(err.message || 'Failed to load opportunities')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [confirmedSemesterId])

  const confirmSemester = async () => {
    if (!selectedSemester) {
      setSemesterError('Please select a semester first')
      return
    }
    try {
      setSubmitting(true)
      setSemesterError(null)
      await UsersService.putMySemesterSelection({ semesterId: selectedSemester })
      setConfirmedSemesterId(selectedSemester)
    } catch (err: any) {
      const reason: string | undefined = err.body?.error?.reason
      setSemesterError(
        (reason && CONFLICT_MESSAGES[reason]) ?? err.message ?? 'Failed to select semester'
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Semester selection step ────────────────────────────────────────────────
  if (!confirmedSemesterId) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Opportunities"
          title="Select Your Semester"
          description="Choose an active semester to browse available internship opportunities."
        />

        <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4">
          <Sparkles className="h-5 w-5 text-red-600" />
          <p className="text-sm text-red-700">
            Only <b>active semesters</b> are eligible for enrollment.
          </p>
        </div>

        {semesterError && (
          <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{semesterError}</div>
        )}

        {loadingSemesters ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            Loading semesters...
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="mt-4 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <h3 className="text-xl font-bold text-slate-900">
                      {sem.semesterCode ?? 'Semester'}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{sem.courseCode}</p>
                  {sem.enrolmentOpenAt && (
                    <p className="mt-2 text-xs text-slate-400">
                      Opens: {new Date(sem.enrolmentOpenAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={confirmSemester}
            disabled={submitting || !selectedSemester}
            className="rounded-2xl bg-red-600 px-8 py-3 font-bold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Confirm & View Opportunities'}
          </button>
          {selectedSemester && (
            <p className="text-sm text-slate-500">
              Selected:{' '}
              <span className="font-semibold text-slate-900">
                {semesters.find((s) => s.id === selectedSemester)?.semesterCode}
              </span>
            </p>
          )}
        </div>
      </div>
    )
  }

  // ── Opportunities list ─────────────────────────────────────────────────────
  const appliedOpportunityIds = new Set(internships.map((i) => i.opportunityId))
  const activeCount = opportunities.filter((o) => o.status === 'published').length
  const appliedCount = internships.length

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <CoordinatorPageHeader
          eyebrow="Opportunities"
          title="Available Internships"
          description="Browse and apply to internship opportunities available in your semester."
        />
        <button
          type="button"
          onClick={() => setConfirmedSemesterId(null)}
          className="shrink-0 rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
        >
          Change Semester
        </button>
      </div>

      {/* KPI ROW */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active roles"
          value={activeCount}
          detail="Published opportunities"
          icon={BriefcaseBusiness}
          tone="red"
          progress={
            opportunities.length > 0 ? Math.round((activeCount / opportunities.length) * 100) : 0
          }
        />
        <KPIStatCard
          title="My applications"
          value={appliedCount}
          detail="Submitted applications"
          icon={BarChart3}
          tone="dark"
          progress={
            activeCount > 0 ? Math.min(Math.round((appliedCount / activeCount) * 100), 100) : 0
          }
        />
        <KPIStatCard
          title="Total available"
          value={opportunities.length}
          detail="Opportunities this semester"
          icon={Sparkles}
          tone="light"
          progress={100}
        />
      </div>

      <AIInsightCard
        title="Opportunity Insights"
        confidence={84}
        insight="Browse published opportunities and apply early to improve your acceptance chances."
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading opportunities...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && opportunities.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No opportunities available for your semester yet.
        </div>
      )}

      {/* OPPORTUNITY GRID */}
      <div className="grid gap-4 lg:grid-cols-3">
        {opportunities.map((opportunity) => {
          const alreadyApplied = appliedOpportunityIds.has(opportunity.id)

          return (
            <SurfaceCard
              key={opportunity.id}
              className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-950">{opportunity.jobTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{opportunity.employerName}</p>
                </div>
                <StatusBadge status={opportunityStatusToBadge(opportunity.status)} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-2xl font-bold text-slate-950">
                    {opportunity.applicationCount}
                  </p>
                  <p className="text-xs text-slate-500">Applications</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-950 capitalize">
                    {opportunity.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">Type</p>
                </div>
              </div>

              {opportunity.workMode && (
                <p className="mt-3 text-xs text-slate-400 capitalize">
                  {opportunity.workMode}
                  {opportunity.location ? ` · ${opportunity.location}` : ''}
                </p>
              )}

              <div className="mt-auto pt-4">
                {alreadyApplied ? (
                  <span className="block w-full rounded-xl bg-slate-100 py-2 text-center text-sm font-semibold text-slate-500">
                    Applied
                  </span>
                ) : opportunity.status === 'published' ? (
                  <Link
                    href={`/student/jobs/${opportunity.id}`}
                    className="block w-full rounded-xl bg-red-600 py-2 text-center text-sm font-bold text-white hover:bg-red-700"
                  >
                    Apply
                  </Link>
                ) : (
                  <span className="block w-full rounded-xl bg-slate-100 py-2 text-center text-sm font-semibold text-slate-400">
                    Not available
                  </span>
                )}
              </div>
            </SurfaceCard>
          )
        })}
      </div>
    </div>
  )
}
