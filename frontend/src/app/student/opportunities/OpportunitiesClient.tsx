'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Briefcase, ChevronRight, MapPin, RefreshCw, Star, Users } from 'lucide-react'

import { useAuth } from '@/hooks/useAuth'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { PlacementConfirmedBanner } from '@/components/student/PlacementConfirmedBanner'
import { SemesterEnrollmentBanner } from '@/components/student/SemesterEnrollmentBanner'
import {
  canApplyToOpportunity,
  hasAnyApprovedPlacement,
} from '@/lib/student/semesterEnrollmentBanner'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'
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
import { canStudentSelectSemester } from '@/lib/semester/studentSemesters'
import {
  SemesterPickerGrid,
  SemesterPickerGridSkeleton,
} from '@/components/student/SemesterPickerGrid'

const CONFLICT_MESSAGES: Record<string, string> = {
  profile_incomplete:
    'Your profile is incomplete. Please fill in your student profile before enrolling.',
  semester_not_active: 'This semester is not accepting new enrollments.',
  enrolment_window_closed: 'The enrolment window for that semester is closed.',
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
  placementConfirmed: boolean
  canApply: boolean
}

function OpportunityRow({
  opportunity,
  myInternship,
  alreadyApplied,
  placementConfirmed,
  canApply,
}: OpportunityRowProps) {
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
          placementConfirmed ? (
            <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
              Placement confirmed
            </span>
          ) : canApply ? (
            <Link
              href={`/student/opportunities/view?id=${opportunity.id}`}
              className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-red-700"
            >
              Apply
            </Link>
          ) : (
            <Link
              href={`/student/opportunities/view?id=${opportunity.id}`}
              className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              View <ArrowRight className="h-3 w-3" />
            </Link>
          )
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

  const [pendingSubmissions, setPendingSubmissions] = useState<OpportunityResponse[]>([])
  const [expandedPendingId, setExpandedPendingId] = useState<string | null>(null)
  const [workflow, setWorkflow] = useState<UserWorkflowResponse | null>(null)
  const [profileSemesterId, setProfileSemesterId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user) return
    const loadSemesters = async () => {
      try {
        setLoadingSemesters(true)
        const [semesterRes, profile, workflowRes] = await Promise.all([
          SemestersService.listSemesters(['enrollment_open', 'placement_running', 'reporting']),
          UsersService.getMyProfile(),
          UsersService.getMyWorkflow().catch(() => null),
        ])
        setWorkflow(workflowRes)
        setSemesters(semesterRes.items)
        if (profile.role === 'student') {
          const savedSemesterId = profile.studentProfile?.semesterId ?? null
          setProfileSemesterId(savedSemesterId)
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

  useEffect(() => {
    if (authLoading || !user || !semesterId) return
    const loadPending = async () => {
      // The backend now returns the student's own non-published custom submissions
      // in listOpportunities. localStorage is a fallback for submissions made before
      // this backend change, or in case of transient errors.
      let ids: string[] = []
      try {
        ids = JSON.parse(localStorage.getItem('internbot:selfSourced:pending') ?? '[]')
      } catch {
        /* ignore */
      }
      if (ids.length === 0) return

      const results = await Promise.allSettled(
        ids.map((id) => OpportunitiesService.getOpportunity(id))
      )
      const still: string[] = []
      const pending: OpportunityResponse[] = []
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          if (r.value.status !== 'published') {
            still.push(ids[i]!)
            pending.push(r.value)
          }
          // published → already in main list via backend; drop from localStorage
        }
        // 404 / 403 → drop silently
      })
      try {
        localStorage.setItem('internbot:selfSourced:pending', JSON.stringify(still))
      } catch {
        /* ignore */
      }
      setPendingSubmissions(pending)
    }
    loadPending()
  }, [authLoading, user, semesterId])

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
    // Show skeleton while loading — the useEffect redirects if a saved semester
    // exists, so returning users never see the picker flash.
    if (loadingSemesters) {
      return (
        <div className="space-y-4" aria-busy="true">
          <div className="space-y-1">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <SemesterPickerGridSkeleton />
        </div>
      )
    }

    return (
      <div className="space-y-8">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
            Opportunities
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Select Your Semester</h1>
          <p className="mt-1 text-sm text-gray-500">
            Choose a semester to browse available internship opportunities.
          </p>
        </div>

        {semesterError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {semesterError}
          </div>
        )}

        <SemesterPickerGrid
          semesters={semesters}
          selectedSemesterId={selectedSemester}
          onSelect={setSelectedSemester}
        />

        {(() => {
          const selectedSem = semesters.find((s) => s.id === selectedSemester)
          const isEnrollmentOpen = selectedSem != null && canStudentSelectSemester(selectedSem)
          const isNonEnrollable = selectedSem != null && !isEnrollmentOpen
          return (
            <>
              {isNonEnrollable && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  This semester is not open for new enrollment. Choose a semester with enrollment
                  open, or continue existing applications from My applications.
                </div>
              )}
              <button
                type="button"
                onClick={confirmSemester}
                disabled={submitting || !selectedSemester || loadingSemesters || !isEnrollmentOpen}
                title={isNonEnrollable ? 'Enrollment for this semester is closed' : undefined}
                className="flex items-center gap-2 rounded-2xl bg-red-600 px-8 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Saving…' : 'Confirm & Browse Opportunities'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )
        })()}
      </div>
    )
  }

  // ── Opportunities list ─────────────────────────────────────────────────────
  const internshipsForSemester = internships.filter((i) => i.semesterId === semesterId)
  const appliedOpportunityIds = new Set(internshipsForSemester.map((i) => i.opportunityId))
  const preApproved = opportunities.filter((o) => o.type === 'pre_approved')
  const selfSourcedApproved = opportunities.filter(
    (o) => o.type === 'custom' && o.status === 'published'
  )
  // Backend now returns the student's own non-published custom submissions directly.
  // localStorage fallback fills any gap (older submissions or transient failures).
  const selfSourcedApprovedIds = new Set(selfSourcedApproved.map((o) => o.id))
  const backendPending = opportunities.filter(
    (o) => o.type === 'custom' && o.status !== 'published'
  )
  const backendPendingIds = new Set(backendPending.map((o) => o.id))
  const localFallback = pendingSubmissions.filter(
    (o) => !backendPendingIds.has(o.id) && !selfSourcedApprovedIds.has(o.id)
  )
  const selfSourcedPending = [...backendPending, ...localFallback]
  const currentSemester = semesters.find((s) => s.id === semesterId)
  const approvedInternship = profileSemesterId
    ? internships.find((i) => i.semesterId === profileSemesterId && i.status === 'offer_approved')
    : undefined
  const hasApprovedPlacement = hasAnyApprovedPlacement(internships)
  const appliedCount = internshipsForSemester.length
  const openSemesterCount = semesters.filter((s) => s.status === 'enrollment_open').length
  const enrolledSemester = profileSemesterId
    ? (semesters.find((s) => s.id === profileSemesterId) ?? null)
    : null
  const browsingOtherSemester = Boolean(
    profileSemesterId && semesterId && semesterId !== profileSemesterId
  )

  const rowProps = (o: OpportunityResponse) => ({
    opportunity: o,
    myInternship: internshipsForSemester.find((i) => i.opportunityId === o.id),
    alreadyApplied: appliedOpportunityIds.has(o.id),
    placementConfirmed: hasApprovedPlacement,
    canApply: canApplyToOpportunity({
      opportunity: o,
      profileSemesterId,
      enrolledSemester,
      internships,
    }),
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

      {hasApprovedPlacement && approvedInternship && currentSemester && (
        <PlacementConfirmedBanner internship={approvedInternship} semester={currentSemester} />
      )}

      <SemesterEnrollmentBanner
        semester={currentSemester ?? null}
        semesterEnrolmentState={workflow?.semesterEnrolmentState}
        internships={internships}
        semesterId={semesterId}
        openSemesterCount={openSemesterCount}
      />

      {browsingOtherSemester && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          You are browsing opportunities for a different semester than the one on your profile. You
          can view roles here, but you can only apply when your{' '}
          <Link href="/student/profile" className="font-bold underline">
            enrolled semester
          </Link>{' '}
          matches.
        </div>
      )}

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
            <p className="text-xl font-bold text-red-600">{selfSourcedApproved.length}</p>
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

      {/* Self-sourced approved section */}
      {!loading && selfSourcedApproved.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-50">
                <Star className="h-3.5 w-3.5 text-red-500" />
              </div>
              <h2 className="text-sm font-bold text-gray-800">Self-sourced Opportunities</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {selfSourcedApproved.length}
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
            {selfSourcedApproved.map((o, idx) => (
              <div key={o.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                <OpportunityRow {...rowProps(o)} />
              </div>
            ))}
          </SurfaceCard>
        </div>
      )}

      {/* Self-sourced pending section */}
      {!loading && selfSourcedPending.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-gray-100">
                <Star className="h-3.5 w-3.5 text-gray-400" />
              </div>
              <h2 className="text-sm font-bold text-gray-800">Your Submitted Opportunities</h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {selfSourcedPending.length}
              </span>
            </div>
            {selfSourcedApproved.length === 0 && (
              <Link
                href="/student/self-sourced-internships"
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                <Star className="h-3 w-3" />
                Submit new
              </Link>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Opportunities you&apos;ve submitted for coordinator review. Once approved, you can
            apply.
          </p>
          <SurfaceCard className="overflow-hidden p-0">
            <div className="grid grid-cols-[1fr_150px_32px] items-center gap-4 border-b border-gray-100 bg-gray-50 px-5 py-2.5 text-xs font-semibold tracking-wide text-gray-400 uppercase">
              <span>Opportunity</span>
              <span>Status</span>
              <span />
            </div>
            {selfSourcedPending.map((o, idx) => {
              const isExpanded = expandedPendingId === o.id
              const statusLabel =
                o.status === 'rejected'
                  ? 'Rejected'
                  : o.status === 'pending_verification'
                    ? 'Pending review'
                    : 'Under review'
              const statusDot = o.status === 'rejected' ? 'bg-red-400' : 'bg-gray-400'
              return (
                <div key={o.id} className={idx > 0 ? 'border-t border-gray-100' : ''}>
                  <button
                    type="button"
                    onClick={() => setExpandedPendingId(isExpanded ? null : o.id)}
                    className="grid w-full grid-cols-[1fr_150px_32px] items-center gap-4 px-5 py-4 text-left transition hover:bg-gray-50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{o.jobTitle}</p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {o.employerName}
                        {o.workMode && (
                          <span className="ml-2 text-gray-300 capitalize">· {o.workMode}</span>
                        )}
                        {o.location && <span className="ml-1 text-gray-300">· {o.location}</span>}
                      </p>
                    </div>
                    <div>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-500">
                        <span className={`h-1.5 w-1.5 rounded-full ${statusDot}`} />
                        {statusLabel}
                      </span>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                      {o.status === 'rejected' ? (
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-red-100">
                            <Star className="h-4 w-4 text-red-500" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Submission rejected
                            </p>
                            {o.verificationComment ? (
                              <div className="mt-2 rounded-xl border border-red-200 bg-white px-3 py-2">
                                <p className="text-xs font-bold tracking-wide text-red-500 uppercase">
                                  Coordinator note
                                </p>
                                <p className="mt-1 text-xs leading-relaxed whitespace-pre-wrap text-gray-700">
                                  {o.verificationComment}
                                </p>
                              </div>
                            ) : (
                              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                                A coordinator reviewed your submission and it was not approved. You
                                can submit a new opportunity with updated details.
                              </p>
                            )}
                            <div className="mt-2.5 flex items-center gap-2">
                              <Link
                                href={`/student/opportunities/review?id=${o.id}`}
                                className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
                              >
                                View Details
                                <ArrowRight className="h-3 w-3" />
                              </Link>
                              <Link
                                href="/student/self-sourced-internships"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                              >
                                Submit another
                              </Link>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <RefreshCw className="h-4 w-4 text-gray-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              Awaiting coordinator approval
                            </p>
                            <p className="mt-1 text-xs leading-relaxed text-gray-500">
                              Your submission is being reviewed. Once a coordinator approves it,
                              this opportunity will appear above and you&apos;ll be able to apply.
                            </p>
                            <Link
                              href={`/student/opportunities/review?id=${o.id}`}
                              className="mt-2.5 inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black"
                            >
                              View Details
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </SurfaceCard>
        </div>
      )}
    </div>
  )
}
