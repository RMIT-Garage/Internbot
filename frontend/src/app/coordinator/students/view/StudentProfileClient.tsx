'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, BriefcaseBusiness, FileText, History } from 'lucide-react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import {
  CoordinatorPageHeader,
  KPIStatCard,
  PillButton,
  SurfaceCard,
} from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import type { CoordinatorStatus } from '@/components/coordinator/StatusBadge'
import { getUser, listInternships } from '@/lib/coordinator/api'
import { coordinatorStudents, type StudentOverallStatus } from '@/lib/coordinator/mockData'
import {
  getInternshipStudentId,
  getInternshipStudentKey,
  hasBackendStudentId,
  hasInternshipOfferDocumentsSubmitted,
  internshipSourceLabel,
  internshipStageLabel,
  internshipUpdatedAt,
} from '@/lib/coordinator/apiMappers'
import { PLACEMENT_PROCESSING_CONTEXT, withReviewReturn } from '@/lib/coordinator/reviewRouting'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'
import type { InternshipListItemResponse, SemesterStudentPlacementStatus } from '@/types/api'

interface StudentProfile {
  id: string
  name: string
  displayName?: string
  email?: string
  course: string
  semester: string
  status: StudentOverallStatus
  placementStatus: string
  latestActivity: string | null
  internships: InternshipListItemResponse[]
}

export function StudentProfileClient() {
  const searchParams = useSearchParams()
  const studentId = searchParams.get('id') ?? ''
  const recordId = searchParams.get('recordId') ?? ''
  const rowId = searchParams.get('rowId') ?? ''
  const returnTo = normalizeReturnTo(searchParams.get('returnTo'))
  const placementStatusHint = parsePlacementStatusHint(searchParams.get('placementStatus'))
  const programCodeHint = searchParams.get('programCode')?.trim() || undefined

  const profileResource = useCoordinatorApiResource(
    async () => {
      if (!studentId) return null
      const canFilterByUserId = !studentId.startsWith('record:')
      const response = await listInternships(
        canFilterByUserId ? { userId: studentId, limit: 100 } : { limit: 100 }
      )
      const profileInternships = canFilterByUserId
        ? response.items
        : response.items.filter(
            (item) =>
              getInternshipStudentKey(item) === rowId ||
              item.id === recordId ||
              getInternshipStudentKey(item) === studentId
          )
      let studentDisplay: string | undefined
      let displayName: string | undefined
      let email: string | undefined
      let programCode: string | undefined
      if (canFilterByUserId) {
        try {
          const user = await getUser(studentId)
          studentDisplay = formatStudentDisplay(user)
          displayName = user.displayName ?? undefined
          email = user.email ?? undefined
          programCode = user.studentProfile?.programCode ?? undefined
        } catch {
          // profile fields stay undefined
        }
      }
      const fromInternships = buildProfile(
        studentId,
        profileInternships,
        recordId,
        studentDisplay,
        displayName,
        email
      )
      if (fromInternships) return fromInternships
      if (!canFilterByUserId || !studentDisplay) return null
      return buildProfileWithoutInternships({
        studentId,
        studentDisplay,
        displayName,
        email,
        programCode: programCodeHint ?? programCode,
        placementStatus: placementStatusHint,
      })
    },
    findFallbackProfile(studentId, rowId),
    `student-profile:${studentId}:${recordId}:${rowId}`,
    { emptyData: null }
  )

  if (!studentId) {
    return (
      <EmptyProfileState
        title="Student profile unavailable"
        message="Select a student from the directory to open their coordinator profile."
        returnTo={returnTo}
      />
    )
  }

  if (profileResource.loading) {
    return <CoordinatorContentSkeleton title="Loading student profile..." />
  }

  const profile = profileResource.data

  if (!profile) {
    return (
      <EmptyProfileState
        title="Student not found"
        message="No WIL records are currently available for this student."
        returnTo={returnTo}
      />
    )
  }

  const contractReviews = profile.internships.filter(
    (item) => item.status === 'offer_pending_review'
  ).length
  const completedReviews = profile.internships.filter(
    (item) => item.status === 'offer_approved' || item.status === 'rejected'
  ).length
  const activeInternships = profile.internships.filter(
    (item) => item.status !== 'offer_approved' && item.status !== 'rejected'
  ).length
  const selfSourcedCount = profile.internships.filter(
    (item) => internshipSourceLabel(item) === 'Self-Sourced'
  ).length
  const coordinatorPublishedCount = profile.internships.length - selfSourcedCount
  const latestUpdate = profile.latestActivity
    ? formatDate(profile.latestActivity)
    : 'No updates yet'

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Profile"
        title={profile.displayName ?? profile.name}
        description="Coordinator view of internship records, review history, and available workflow context."
        actions={
          <>
            <PillButton href={returnTo} variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to students
            </PillButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Internship records"
          value={profile.internships.length}
          detail="WIL workflow records"
          icon={BriefcaseBusiness}
          tone="charcoal"
        />
        <KPIStatCard
          title="Contract reviews"
          value={contractReviews}
          detail="Coordinator action required"
          icon={FileText}
          tone={contractReviews > 0 ? 'red' : 'neutral'}
        />
        <KPIStatCard
          title="Completed reviews"
          value={completedReviews}
          detail="Approved or rejected"
          icon={History}
          tone="neutral"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <SurfaceCard className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">
                  Student Details
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {profile.displayName ?? profile.name}
                </h2>
                {profile.displayName && profile.displayName !== profile.name && (
                  <p className="mt-0.5 text-sm text-slate-500">{profile.name}</p>
                )}
              </div>
              <StatusBadge status={profile.status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Name', profile.displayName],
                ['Student ID', profile.name],
                ['Email', profile.email],
                ['Course/program', profile.course],
                ['Semester', profile.semester],
                ['Placement status', profile.placementStatus],
                [
                  'Latest activity',
                  profile.latestActivity ? formatDate(profile.latestActivity) : null,
                ],
              ]
                .filter(([, value]) => isRealProfileValue(value))
                .map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-4">
                    <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                      {label}
                    </dt>
                    <dd className="mt-2 text-sm font-semibold text-slate-950">{value}</dd>
                  </div>
                ))}
            </dl>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">Internships and Applications</h2>
              <p className="mt-1 text-sm text-slate-500">
                Current WIL records, source, status, and review path for this student.
              </p>
            </div>
            <div className="overflow-x-auto">
              {profile.internships.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  No internships or applications recorded for this student.
                </div>
              )}
              {profile.internships.length > 0 && (
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
                    <tr>
                      {[
                        'Role',
                        'Employer',
                        'Source',
                        'Status',
                        'Stage',
                        'Semester',
                        'Updated',
                        'Action',
                      ].map((header) => (
                        <th key={header} scope="col" className="px-4 py-3">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.internships.map((item) => (
                      <tr key={item.id} className={item.id === recordId ? 'bg-red-50' : undefined}>
                        <td className="px-4 py-4 font-bold text-slate-950">
                          {item.opportunityJobTitle}
                        </td>
                        <td className="px-4 py-4 text-slate-700">{item.opportunityEmployerName}</td>
                        <td className="px-4 py-4 text-slate-700">{internshipSourceLabel(item)}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={internshipStatusBadge(item)} />
                        </td>
                        <td className="px-4 py-4 text-slate-700">
                          {internshipTableStageLabel(item)}
                        </td>
                        <td className="px-4 py-4 text-slate-700">{profile.semester}</td>
                        <td className="px-4 py-4 text-slate-700">
                          {formatDate(internshipUpdatedAt(item))}
                        </td>
                        <td className="px-4 py-4">
                          {hasInternshipOfferDocumentsSubmitted(item) ? (
                            <Link
                              href={withReviewReturn(
                                `/coordinator/contracts/review?id=${encodeURIComponent(item.id)}`,
                                returnTo,
                                { context: PLACEMENT_PROCESSING_CONTEXT }
                              )}
                              className="text-sm font-bold text-red-700 hover:text-red-800"
                            >
                              View details
                            </Link>
                          ) : (
                            <span className="text-sm text-slate-400">Awaiting documents</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6">
          <SurfaceCard className="p-5">
            <h2 className="font-bold text-slate-950">WIL Operations Summary</h2>
            <dl className="mt-4 space-y-3">
              {[
                ['Active internships/applications', String(activeInternships)],
                ['Current highest stage', profile.placementStatus],
                [
                  'Source mix',
                  `${selfSourcedCount} self-sourced / ${coordinatorPublishedCount} coordinator published`,
                ],
                ['Latest submission/update', latestUpdate],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}

function EmptyProfileState({
  title,
  message,
  returnTo,
}: {
  title: string
  message: string
  returnTo: string
}) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Profile"
        title={title}
        description={message}
        actions={
          <PillButton href={returnTo} variant="secondary">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to students
          </PillButton>
        }
      />
      <SurfaceCard className="p-8 text-center text-sm text-slate-500">{message}</SurfaceCard>
    </div>
  )
}

const SEMESTER_PLACEMENT_STATUS_LABELS: Record<SemesterStudentPlacementStatus, string> = {
  no_applications: 'No Applications',
  browsing: 'Browsing',
  offer_in_review: 'Offer in Review',
  offer_changes_requested: 'Changes Requested',
  offer_approved: 'Offer Approved',
  all_rejected: 'All Rejected',
}

function buildProfileWithoutInternships(input: {
  studentId: string
  studentDisplay: string
  displayName?: string
  email?: string
  programCode?: string
  placementStatus?: SemesterStudentPlacementStatus
}): StudentProfile {
  const placementLabel = input.placementStatus
    ? SEMESTER_PLACEMENT_STATUS_LABELS[input.placementStatus]
    : 'No placement activity yet'

  return {
    id: input.studentId,
    name: input.studentDisplay,
    displayName: input.displayName,
    email: input.email,
    course: input.programCode ?? 'To confirm',
    semester: 'Enrolled semester',
    status: overallStatusFromPlacement(input.placementStatus),
    placementStatus: placementLabel,
    latestActivity: null,
    internships: [],
  }
}

function overallStatusFromPlacement(
  placementStatus?: SemesterStudentPlacementStatus
): StudentOverallStatus {
  switch (placementStatus) {
    case 'offer_changes_requested':
    case 'all_rejected':
      return 'needs_attention'
    case 'offer_approved':
      return 'approved'
    case 'no_applications':
      return 'inactive'
    default:
      return 'on_track'
  }
}

function parsePlacementStatusHint(
  value: string | null
): SemesterStudentPlacementStatus | undefined {
  if (!value) return undefined
  const statuses: SemesterStudentPlacementStatus[] = [
    'no_applications',
    'browsing',
    'offer_in_review',
    'offer_changes_requested',
    'offer_approved',
    'all_rejected',
  ]
  return statuses.includes(value as SemesterStudentPlacementStatus)
    ? (value as SemesterStudentPlacementStatus)
    : undefined
}

function buildProfile(
  studentId: string,
  internships: InternshipListItemResponse[],
  selectedRecordId: string,
  studentDisplay?: string,
  displayName?: string,
  email?: string
): StudentProfile | null {
  if (internships.length === 0) return null
  const sorted = [...internships].sort((a, b) => {
    if (a.id === selectedRecordId) return -1
    if (b.id === selectedRecordId) return 1
    return (
      Date.parse(b.lastSubmittedAt ?? b.createdAt) - Date.parse(a.lastSubmittedAt ?? a.createdAt)
    )
  })
  const latest = sorted[0]!
  const courses = new Set(sorted.map((item) => item.studentProgramCode).filter(Boolean))
  const profileStudentId = hasBackendStudentId(latest) ? getInternshipStudentId(latest) : studentId

  return {
    id: profileStudentId,
    name: studentDisplay ?? formatStudentDisplay({ studentId: profileStudentId }),
    displayName,
    email,
    course: courses.size > 1 ? 'Multiple programs' : (latest.studentProgramCode ?? 'To confirm'),
    semester: 'Current semester',
    status: aggregateStudentStatus(sorted.map((item) => item.status)),
    placementStatus: internshipTableStageLabel(latest),
    latestActivity: internshipUpdatedAt(latest),
    internships: sorted,
  }
}

function findFallbackProfile(studentId: string, rowId: string): StudentProfile | null {
  const student = coordinatorStudents.find(
    (item) => item.rowId === rowId || item.id === studentId || item.studentId === studentId
  )
  if (!student) return null

  return {
    id: student.studentId,
    name: formatStudentDisplay(student),
    displayName: student.name,
    email: student.email,
    course: student.course,
    semester: student.semester,
    status: student.overallStatus,
    placementStatus: student.placementStatus ?? '',
    latestActivity: student.lastAudit ?? null,
    internships: [],
  }
}

function isRealProfileValue(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()
  return Boolean(
    normalized && normalized !== 'not recorded' && normalized !== 'no placement status recorded'
  )
}

function aggregateStudentStatus(
  statuses: InternshipListItemResponse['status'][]
): StudentOverallStatus {
  if (statuses.some((status) => status === 'rejected' || status === 'offer_changes_requested')) {
    return 'needs_attention'
  }
  if (statuses.some((status) => status === 'offer_approved')) return 'approved'
  if (statuses.length === 0) return 'inactive'
  return 'on_track'
}

function internshipStatusBadge(item: InternshipListItemResponse): CoordinatorStatus {
  if (isPlacementApprovalStage(item)) return 'awaiting_placement_approval'
  if (item.status === 'offer_pending_review') return 'awaiting_contract_review'
  if (item.status === 'offer_approved') return 'approved'
  if (item.status === 'offer_changes_requested') return 'awaiting_documents'
  if (item.status === 'rejected') return 'rejected'
  return 'awaiting_contract_details'
}

function internshipTableStageLabel(item: InternshipListItemResponse) {
  if (isPlacementApprovalStage(item)) return 'Placement Approval'
  if (item.status === 'applied') return 'Awaiting Contract Review'
  return internshipStageLabel(item.status)
}

function isPlacementApprovalStage(item: InternshipListItemResponse) {
  const status = String(item.status)
  return status === 'pending' || status === 'awaiting_review' || status === 'awaiting_approval'
}

function normalizeReturnTo(value: string | null) {
  if (!value) return '/coordinator/students'
  if (
    value.startsWith('/coordinator/students') ||
    value.startsWith('/coordinator/semesters/students')
  ) {
    return value
  }
  return '/coordinator/students'
}
