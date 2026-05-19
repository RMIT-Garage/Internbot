'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Bell, BriefcaseBusiness, FileText, History, ShieldAlert } from 'lucide-react'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import {
  CoordinatorPageHeader,
  KPIStatCard,
  PillButton,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import type { CoordinatorStatus } from '@/components/coordinator/StatusBadge'
import { listInternships } from '@/lib/coordinator/api'
import { coordinatorStudents, type StudentOverallStatus } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { formatDate } from '@/lib/utils'
import type { InternshipListItemResponse } from '@/types/api'

interface StudentProfile {
  id: string
  name: string
  email: string
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

  const profileResource = useCoordinatorApiResource(
    async () => {
      if (!studentId) return null
      const response = await listInternships({ userId: studentId, limit: 100 })
      return buildProfile(studentId, response.items, recordId)
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
        message={
          profileResource.error
            ? `API unavailable: ${profileResource.error}`
            : 'Backend connected, but no records exist yet.'
        }
        returnTo={returnTo}
      />
    )
  }

  const pendingReviews = profile.internships.filter(
    (item) => item.status === 'offer_pending_review'
  ).length
  const completedReviews = profile.internships.filter(
    (item) => item.status === 'offer_approved' || item.status === 'rejected'
  ).length
  const activityItems = profile.internships.map((item) => ({
    title: item.status.replace(/_/g, ' '),
    description: `${item.opportunityJobTitle} at ${item.opportunityEmployerName}`,
    time: formatDate(item.lastSubmittedAt ?? item.createdAt),
    tone:
      item.status === 'rejected' || item.status === 'offer_changes_requested'
        ? ('red' as const)
        : item.status === 'offer_approved'
          ? ('charcoal' as const)
          : ('neutral' as const),
  }))

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Profile"
        title={profile.name}
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

      {profileResource.error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {`Using isolated fallback data: ${profileResource.error}`}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Internship records"
          value={profile.internships.length}
          detail="Backend-connected records"
          icon={BriefcaseBusiness}
          tone="charcoal"
        />
        <KPIStatCard
          title="Pending reviews"
          value={pendingReviews}
          detail="Coordinator action required"
          icon={FileText}
          tone={pendingReviews > 0 ? 'red' : 'neutral'}
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
                <h2 className="mt-2 text-xl font-bold text-slate-950">{profile.id}</h2>
              </div>
              <StatusBadge status={profile.status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ['Student ID', profile.id],
                ['Email', profile.email],
                ['Course/program', profile.course],
                ['Semester', profile.semester],
                ['Placement status', profile.placementStatus],
                [
                  'Latest activity',
                  profile.latestActivity
                    ? formatDate(profile.latestActivity)
                    : 'No activity recorded',
                ],
              ].map(([label, value]) => (
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
              <h2 className="text-lg font-bold text-slate-950">Contract and Review History</h2>
              <p className="mt-1 text-sm text-slate-500">
                Internship records returned by the backend for this student.
              </p>
            </div>
            <div className="divide-y divide-slate-100">
              {profile.internships.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  Backend connected, but no records exist yet.
                </div>
              )}
              {profile.internships.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.id === recordId
                      ? 'grid gap-3 bg-red-50 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
                      : 'grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
                  }
                >
                  <div>
                    <p className="font-bold text-slate-950">{item.opportunityJobTitle}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.opportunityEmployerName} - {formatDate(item.createdAt)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">
                      {item.opportunityType.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <StatusBadge status={statusToBadge(item.status)} />
                    <Link
                      href={`/coordinator/contracts/review?id=${encodeURIComponent(item.id)}`}
                      className="text-sm font-bold text-red-700 hover:text-red-800"
                    >
                      Open review
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6">
          <SurfaceCard className="p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-red-700" />
              <h2 className="font-bold text-slate-950">AI and Risk Summary</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Additional student profile data unavailable. Risk indicators are derived from current
              internship review statuses only.
            </p>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-semibold text-slate-800">
              {pendingReviews > 0
                ? 'Coordinator review is pending for this student.'
                : 'No pending coordinator review detected.'}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-red-700" />
              <h2 className="font-bold text-slate-950">Notifications</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Additional student profile data unavailable. Student-specific notification filtering
              is not exposed by the current frontend API helpers.
            </p>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="font-bold text-slate-950">Recent Activity</h2>
            <div className="mt-4">
              {activityItems.length > 0 ? (
                <TimelineFeed items={activityItems} />
              ) : (
                <p className="text-sm text-slate-500">No activity recorded for this student.</p>
              )}
            </div>
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

function buildProfile(
  studentId: string,
  internships: InternshipListItemResponse[],
  selectedRecordId: string
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

  return {
    id: studentId,
    name: studentId,
    email: 'Additional student profile data unavailable.',
    course:
      courses.size > 1 ? 'Multiple programs' : (latest.studentProgramCode ?? 'Program pending'),
    semester: 'Current semester',
    status: aggregateStudentStatus(sorted.map((item) => item.status)),
    placementStatus: latest.status.replace(/_/g, ' '),
    latestActivity: latest.lastSubmittedAt ?? latest.createdAt,
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
    name: student.name,
    email: student.email,
    course: student.course,
    semester: student.semester,
    status: student.overallStatus,
    placementStatus: student.placementStatus ?? 'Additional student profile data unavailable.',
    latestActivity: student.lastAudit ?? null,
    internships: [],
  }
}

function aggregateStudentStatus(
  statuses: InternshipListItemResponse['status'][]
): StudentOverallStatus {
  if (
    statuses.some(
      (status) =>
        status === 'rejected' ||
        status === 'offer_changes_requested' ||
        status === 'offer_pending_review'
    )
  ) {
    return 'needs_attention'
  }
  if (statuses.some((status) => status === 'offer_approved')) return 'approved'
  if (statuses.length === 0) return 'inactive'
  return 'on_track'
}

function statusToBadge(status: InternshipListItemResponse['status']): CoordinatorStatus {
  if (status === 'offer_pending_review') return 'pending'
  if (status === 'offer_approved') return 'approved'
  if (status === 'offer_changes_requested') return 'changes_requested'
  if (status === 'rejected') return 'rejected'
  return 'flagged'
}

function normalizeReturnTo(value: string | null) {
  if (!value || !value.startsWith('/coordinator/students')) return '/coordinator/students'
  return value
}
