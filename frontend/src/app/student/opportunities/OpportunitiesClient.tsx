'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  MapPin,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
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
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'That semester is no longer active.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
}

const APPLY_CONFLICT_MESSAGES: Record<string, string> = {
  duplicate_application: 'You have already applied to this opportunity.',
  student_has_no_selected_semester: 'Pick a semester before applying. Use "Change Semester" above.',
  opportunity_not_published: 'This opportunity is no longer accepting applications.',
  opportunity_semester_mismatch: 'This opportunity is not part of your selected semester.',
}

function internshipStatusToBadge(status: InternshipListItemResponse.status): StudentStatus {
  const map: Record<string, StudentStatus> = {
    applied: 'applied',
    offer_pending_review: 'offer_pending_review',
    offer_changes_requested: 'offer_changes_requested',
    offer_approved: 'offer_approved',
    rejected: 'rejected',
  }
  return map[status] ?? 'applied'
}

interface OpportunityRowProps {
  opportunity: OpportunityResponse
  myInternship: InternshipListItemResponse | undefined
  alreadyApplied: boolean
  applyingId: string | null
  onApply: (id: string) => void
}

function OpportunityRow({
  opportunity,
  myInternship,
  alreadyApplied,
  applyingId,
  onApply,
}: OpportunityRowProps) {
  const isApplying = applyingId === opportunity.id

  return (
    <div className="grid grid-cols-[1fr_150px_110px] items-center gap-6 px-5 py-4 transition hover:bg-gray-50">
      {/* Opportunity info */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-gray-900">{opportunity.jobTitle}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="text-xs text-gray-500">{opportunity.employerName}</span>
          {opportunity.workMode && (
            <span className="text-xs text-gray-400 capitalize">{opportunity.workMode}</span>
          )}
          {opportunity.location && (
            <span className="flex items-center gap-0.5 text-xs text-gray-400">
              <MapPin className="h-3 w-3" />
              {opportunity.location}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="h-3 w-3" />
            {opportunity.applicationCount}
          </span>
        </div>
      </div>

      {/* Status */}
      <div>
        {myInternship ? (
          <StatusBadge status={internshipStatusToBadge(myInternship.status)} />
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-center">
        {alreadyApplied && myInternship ? (
          <Link
            href={`/student/applications/view?id=${myInternship.id}`}
            className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            View <ArrowRight className="h-3 w-3" />
          </Link>
        ) : opportunity.status === 'published' ? (
          <button
            type="button"
            onClick={() => onApply(opportunity.id)}
            disabled={applyingId !== null}
            className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          >
            {isApplying ? 'Applying…' : 'Apply'}
          </button>
        ) : (
          <span className="rounded-xl bg-gray-100 px-3 py-2 text-xs font-medium text-gray-400">
            Closed
          </span>
        )}
      </div>
    </div>
  )
}

function OpportunityListSkeleton() {
  return (
    <SurfaceCard className="overflow-hidden p-0">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}
        >
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-8 w-16 rounded-xl" />
        </div>
      ))}
    </SurfaceCard>
  )
}

export default function StudentOpportunitiesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const semesterId = searchParams.get('semesterId') ?? undefined
  const wantsChange = searchParams.get('change') === '1'

  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null)
  const [loadingSemesters, setLoadingSemesters] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [semesterError, setSemesterError] = useState<string | null>(null)

  const [opportunities, setOpportunities] = useState<OpportunityResponse[]>([])
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    const loadSemesters = async () => {
      try {
        setLoadingSemesters(true)
        const [semesterRes, profile] = await Promise.all([
          SemestersService.listSemesters(['active']),
          UsersService.getMyProfile(),
        ])
        setSemesters(semesterRes.items)
        if (profile.role === 'student') {
          const savedSemesterId = profile.studentProfile?.semesterId ?? null
          setSelectedSemester(savedSemesterId)
          if (savedSemesterId && !semesterId && !wantsChange) {
            router.replace(`/student/opportunities?semesterId=${savedSemesterId}`)
          }
        }
      } catch {
        // Non-fatal
      } finally {
        setLoadingSemesters(false)
      }
    }
    loadSemesters()
  }, [authLoading, user, router, semesterId, wantsChange])

  useEffect(() => {
    if (authLoading || !user || !semesterId) return
    const loadData = async () => {
      try {
        setLoading(true)
        setOpportunities([])
        setInternships([])
        const [oppRes, intRes] = await Promise.all([
          OpportunitiesService.listOpportunities(semesterId),
          InternshipsService.listInternships(),
        ])
        setOpportunities(oppRes.items)
        setInternships(intRes.items)
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load opportunities'))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [authLoading, user, semesterId])

  const applyToOpportunity = async (opportunityId: string) => {
    setApplyError(null)
    setApplyingId(opportunityId)
    try {
      await InternshipsService.createInternship({ opportunityId })
      const refreshed = await InternshipsService.listInternships()
      setInternships(refreshed.items)
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setApplyError(
        (reason && APPLY_CONFLICT_MESSAGES[reason]) ??
          getApiErrorMessage(err, 'Failed to submit application')
      )
    } finally {
      setApplyingId(null)
    }
  }

  const confirmSemester = async () => {
    if (!selectedSemester) {
      setSemesterError('Please select a semester first')
      return
    }
    try {
      setSubmitting(true)
      setSemesterError(null)
      await UsersService.putMySemesterSelection({ semesterId: selectedSemester })
      router.push(`/student/opportunities?semesterId=${selectedSemester}`)
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setSemesterError(
        (reason && CONFLICT_MESSAGES[reason]) ??
          getApiErrorMessage(err, 'Failed to select semester')
      )
    } finally {
      setSubmitting(false)
    }
  }

  // ── Semester selection ─────────────────────────────────────────────────────
  if (!semesterId) {
    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
            Opportunities
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Select Your Semester</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose an active semester to browse available internship opportunities.
          </p>
        </div>

        {semesterError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {semesterError}
          </div>
        )}

        {loadingSemesters ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <SurfaceCard key={i} className="p-6">
                <div className="flex items-start justify-between">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                </div>
                <Skeleton className="mt-5 h-6 w-36" />
                <Skeleton className="mt-2 h-3 w-24" />
                <Skeleton className="mt-3 h-3 w-32" />
              </SurfaceCard>
            ))}
          </div>
        ) : semesters.length === 0 ? (
          <SurfaceCard className="flex flex-col items-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
              <CalendarDays className="h-6 w-6 text-gray-400" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-600">No active semesters</p>
            <p className="mt-1 text-xs text-gray-400">
              Please check back later or contact your coordinator.
            </p>
          </SurfaceCard>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {semesters.map((sem) => {
              const isSelected = selectedSemester === sem.id
              return (
                <button
                  key={sem.id}
                  type="button"
                  onClick={() => setSelectedSemester(sem.id)}
                  className={`w-full rounded-2xl border p-6 text-left transition ${
                    isSelected
                      ? 'border-red-500 bg-red-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        sem.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {sem.status}
                    </span>
                    <div
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                    </div>
                  </div>
                  <p className="mt-4 text-lg font-bold text-gray-900">
                    {sem.semesterCode ?? 'Semester'}
                  </p>
                  {sem.courseCode && (
                    <p className="mt-0.5 text-sm text-gray-500">{sem.courseCode}</p>
                  )}
                  {sem.enrolmentOpenAt && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                      <CalendarDays className="h-3.5 w-3.5" />
                      Opens{' '}
                      {new Date(sem.enrolmentOpenAt).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <button
          type="button"
          onClick={confirmSemester}
          disabled={submitting || !selectedSemester || loadingSemesters}
          className="flex items-center gap-2 rounded-2xl bg-red-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          {submitting ? 'Saving…' : 'Confirm & Browse Opportunities'}
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    )
  }

  // ── Opportunities list ─────────────────────────────────────────────────────
  const appliedOpportunityIds = new Set(internships.map((i) => i.opportunityId))
  const preApproved = opportunities.filter((o) => o.type === 'pre_approved')
  const selfSourced = opportunities.filter((o) => o.type === 'custom')
  const currentSemester = semesters.find((s) => s.id === semesterId)
  const appliedCount = internships.length

  const rowProps = (o: OpportunityResponse) => ({
    opportunity: o,
    myInternship: internships.find((i) => i.opportunityId === o.id),
    alreadyApplied: appliedOpportunityIds.has(o.id),
    applyingId,
    onApply: applyToOpportunity,
  })

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
            Opportunities
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Available Internships</h1>
          {currentSemester && (
            <p className="mt-0.5 text-sm text-gray-500">
              {currentSemester.semesterCode}
              {currentSemester.courseCode ? ` · ${currentSemester.courseCode}` : ''}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/student/self-sourced-internships"
            className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
          >
            <Star className="h-3.5 w-3.5" />
            Submit Self-Sourced
          </Link>
          <button
            type="button"
            onClick={() => router.push('/student/opportunities?change=1')}
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Change semester
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Briefcase className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{preApproved.length}</p>
            <p className="text-xs text-gray-400">Pre-approved roles</p>
          </div>
        </SurfaceCard>
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <Star className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-red-600">{selfSourced.length}</p>
            <p className="text-xs text-gray-400">Self-sourced</p>
          </div>
        </SurfaceCard>
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
            <Users className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{appliedCount}</p>
            <p className="text-xs text-gray-400">My applications</p>
          </div>
        </SurfaceCard>
      </div>

      {/* Error banners */}
      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {applyError && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{applyError}</span>
          <button
            type="button"
            onClick={() => setApplyError(null)}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && opportunities.length === 0 && (
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-4 w-40" />
            <OpportunityListSkeleton />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-48" />
            <OpportunityListSkeleton />
          </div>
        </div>
      )}

      {/* No opportunities */}
      {!loading && opportunities.length === 0 && !error && (
        <SurfaceCard className="flex flex-col items-center py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <Briefcase className="h-6 w-6 text-gray-400" />
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-600">No opportunities yet</p>
          <p className="mt-1 text-xs text-gray-400">
            No opportunities have been published for your semester yet.
          </p>
        </SurfaceCard>
      )}

      {/* Pre-approved section */}
      {!loading && preApproved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50">
              <Briefcase className="h-3.5 w-3.5 text-red-500" />
            </div>
            <h2 className="text-sm font-bold text-gray-800">Pre-approved Opportunities</h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
              {preApproved.length}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Vetted by your coordinator — apply directly and submit your offer documents once
            accepted.
          </p>
          <SurfaceCard className="overflow-hidden p-0">
            {/* List header */}
            <div className="grid grid-cols-[1fr_150px_110px] items-center gap-6 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              <span>Opportunity</span>
              <span>Status</span>
              <span className="text-center">Action</span>
            </div>
            {preApproved.map((o, idx) => (
              <div key={o.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                <OpportunityRow {...rowProps(o)} />
              </div>
            ))}
          </SurfaceCard>
        </div>
      )}

      {/* Self-sourced section */}
      {!loading && selfSourced.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50">
                <Star className="h-3.5 w-3.5 text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-800">Self-sourced Opportunities</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {selfSourced.length}
              </span>
            </div>
            <Link
              href="/student/self-sourced-internships"
              className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            >
              <Star className="h-3 w-3" />
              Submit new
            </Link>
          </div>
          <p className="text-xs text-gray-400">
            Opportunities sourced by students and verified by a coordinator.
          </p>
          <SurfaceCard className="overflow-hidden p-0">
            <div className="grid grid-cols-[1fr_150px_110px] items-center gap-6 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              <span>Opportunity</span>
              <span>Status</span>
              <span className="text-center">Action</span>
            </div>
            {selfSourced.map((o, idx) => (
              <div key={o.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                <OpportunityRow {...rowProps(o)} />
              </div>
            ))}
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
