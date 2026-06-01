'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  Monitor,
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
import {
  canApplyToOpportunity,
  findApprovedPlacement,
  getApplyBlockReason,
  type ApplyBlockReason,
} from '@/lib/student/semesterEnrollmentBanner'

const APPLY_CONFLICT_MESSAGES: Record<string, string> = {
  duplicate_application: 'You have already applied to this opportunity.',
  student_has_no_selected_semester: 'You must select a semester before applying.',
  opportunity_not_published: 'This opportunity is no longer accepting applications.',
  opportunity_semester_mismatch: 'This opportunity is not part of your selected semester.',
  semester_not_active:
    'Your selected semester is not open for new applications. Update your semester from Profile or check My applications.',
}

function applyBlockedMessage(reason: ApplyBlockReason): string | null {
  switch (reason) {
    case 'ok':
      return null
    case 'semester_mismatch':
      return 'This role is not in your enrolled semester. Update your profile semester to apply here.'
    case 'no_profile_semester':
      return 'Select an enrolled semester on your profile before applying.'
    case 'placement_confirmed':
      return 'You already have a confirmed placement elsewhere, so you cannot start a new application for this role.'
    case 'enrollment_closed':
      return 'Your enrolled semester is not open for new applications. Update your semester from Profile or check My applications.'
    case 'not_published':
      return 'This opportunity is not accepting applications.'
    default:
      return null
  }
}

function applySidebarStatus(
  reason: ApplyBlockReason,
  canApply: boolean
): { headline: string; detail?: string } {
  if (canApply) {
    return { headline: 'Open for applications' }
  }
  switch (reason) {
    case 'placement_confirmed':
      return {
        headline: "Can't apply",
        detail: 'You have a confirmed placement in another semester',
      }
    case 'semester_mismatch':
      return {
        headline: "Can't apply",
        detail: 'Not in your enrolled semester',
      }
    case 'enrollment_closed':
      return {
        headline: "Can't apply",
        detail: 'Enrollment closed on your profile',
      }
    case 'no_profile_semester':
      return { headline: "Can't apply", detail: 'No semester on your profile' }
    case 'not_published':
      return { headline: 'Closed', detail: 'Not accepting applications' }
    default:
      return { headline: 'View only' }
  }
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

function OpportunityDetailContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = searchParams.get('id') ?? ''

  const [opportunity, setOpportunity] = useState<OpportunityResponse | null>(null)
  const [myInternship, setMyInternship] = useState<InternshipListItemResponse | null>(null)
  const [semester, setSemester] = useState<SemesterResponse | null>(null)
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [profileSemesterId, setProfileSemesterId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user || !id) return
    const load = async () => {
      try {
        setLoading(true)
        const [opp, intRes, profile] = await Promise.all([
          OpportunitiesService.getOpportunity(id),
          InternshipsService.listInternships(),
          UsersService.getMyProfile(),
        ])
        setOpportunity(opp)
        setInternships(intRes.items)
        setMyInternship(intRes.items.find((i) => i.opportunityId === id) ?? null)
        const selectedSemesterId =
          profile.role === 'student' ? (profile.studentProfile?.semesterId ?? null) : null
        setProfileSemesterId(selectedSemesterId)
        const semesterRes =
          selectedSemesterId != null
            ? await SemestersService.getSemester(selectedSemesterId).catch(() => null)
            : null
        setSemester(semesterRes)
      } catch (err) {
        const reason = getApiErrorReason(err)
        if (reason === 'opportunity_not_visible') {
          router.replace('/student/opportunities')
        } else {
          setError(getApiErrorMessage(err, 'Failed to load opportunity'))
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [authLoading, user, id, router])

  const handleApply = async () => {
    if (!opportunity) return
    setApplyError(null)
    setApplying(true)
    if (opportunity.sourceUrl) {
      window.open(opportunity.sourceUrl, '_blank', 'noopener,noreferrer')
    }
    try {
      const internship = await InternshipsService.createInternship({ opportunityId: id })
      router.push(`/student/applications/view?id=${internship.id}`)
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setApplyError(
        (reason && APPLY_CONFLICT_MESSAGES[reason]) ??
          getApiErrorMessage(err, 'Failed to submit application')
      )
    } finally {
      setApplying(false)
    }
  }

  if (!id) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No opportunity ID provided.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <SurfaceCard className="p-5">
              <Skeleton className="h-4 w-32" />
              <div className="mt-4 space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5">
            <Skeleton className="h-4 w-24" />
          </SurfaceCard>
        </div>
      </div>
    )
  }

  const applyBlockReason =
    opportunity != null && !myInternship
      ? getApplyBlockReason({
          opportunity,
          profileSemesterId,
          enrolledSemester: semester,
          internships,
        })
      : 'not_published'

  const canApply =
    opportunity != null &&
    !myInternship &&
    canApplyToOpportunity({
      opportunity,
      profileSemesterId,
      enrolledSemester: semester,
      internships,
    })

  const applyBlockedText = applyBlockedMessage(applyBlockReason)
  const approvedPlacement = findApprovedPlacement(internships)
  const sidebarStatus = applySidebarStatus(applyBlockReason, canApply)

  if (error || !opportunity) {
    return (
      <div className="space-y-4">
        <Link
          href="/student/opportunities"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Opportunities
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Opportunity not found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link
        href="/student/opportunities"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Opportunities
      </Link>

      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
          Internship Opportunity
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{opportunity.jobTitle}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{opportunity.employerName}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              {opportunity.employerName}
            </div>
            {opportunity.workMode && (
              <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 capitalize">
                <Monitor className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.workMode}
              </div>
            )}
            {opportunity.location && (
              <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.location}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              {opportunity.applicationCount} applicant
              {opportunity.applicationCount !== 1 ? 's' : ''}
            </div>
          </div>

          <SurfaceCard className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <FileText className="h-3.5 w-3.5 text-red-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Position Description</p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
              {opportunity.descriptionText}
            </p>
          </SurfaceCard>

          {opportunity.attachments.length > 0 && (
            <SurfaceCard className="p-5">
              <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                  <Briefcase className="h-3.5 w-3.5 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Attachments</p>
              </div>
              <ul className="space-y-2">
                {opportunity.attachments.map((a) => (
                  <li key={a.id} className="text-sm text-gray-700">
                    {a.fileName}
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}

          {opportunity.sourceUrl && (
            <div className="text-xs text-gray-400">
              Source:{' '}
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                {opportunity.sourceUrl}
              </a>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <SurfaceCard className="p-5">
            {myInternship ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                  <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">
                    Your Application
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={internshipStatusToBadge(myInternship.status)} />
                  </div>
                </div>
                <Link
                  href={`/student/applications/view?id=${myInternship.id}`}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  View Application
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  className={`rounded-xl border p-3 ${
                    canApply ? 'border-gray-100 bg-gray-50' : 'border-amber-200 bg-amber-50'
                  }`}
                >
                  <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">
                    This role
                  </p>
                  <p
                    className={`mt-1 text-sm font-semibold ${
                      canApply ? 'text-gray-900' : 'text-amber-950'
                    }`}
                  >
                    {sidebarStatus.headline}
                  </p>
                  {sidebarStatus.detail && (
                    <p className="mt-1 text-xs text-amber-800/90">{sidebarStatus.detail}</p>
                  )}
                </div>

                {applyError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    {applyError}
                  </div>
                )}

                {canApply ? (
                  <>
                    <button
                      type="button"
                      onClick={handleApply}
                      disabled={applying}
                      className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                      {applying ? 'Submitting…' : 'Apply Now'}
                    </button>
                    <p className="text-center text-[11px] text-gray-400">
                      You&apos;ll be redirected to your application after submitting.
                    </p>
                  </>
                ) : (
                  <div className="space-y-3">
                    <p className="text-center text-xs leading-5 text-amber-800">
                      {applyBlockedText ?? 'You cannot apply to this role right now.'}
                    </p>
                    {applyBlockReason === 'semester_mismatch' && (
                      <Link
                        href="/student/profile"
                        className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                      >
                        Update enrolled semester
                      </Link>
                    )}
                    {applyBlockReason === 'placement_confirmed' && approvedPlacement && (
                      <Link
                        href={`/student/applications/view?id=${approvedPlacement.id}`}
                        className="block text-center text-xs font-bold text-red-700 underline hover:text-red-800"
                      >
                        View your confirmed placement
                      </Link>
                    )}
                    {(applyBlockReason === 'enrollment_closed' ||
                      applyBlockReason === 'semester_mismatch') && (
                      <Link
                        href="/student/applications"
                        className="flex w-full items-center justify-center text-xs font-bold text-red-700 underline"
                      >
                        My applications
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  )
}

export default function OpportunityDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-72" />
        </div>
      }
    >
      <OpportunityDetailContent />
    </Suspense>
  )
}
