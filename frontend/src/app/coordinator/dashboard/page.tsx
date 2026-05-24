'use client'

import Link from 'next/link'
import {
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  Users,
} from 'lucide-react'
import {
  CoordinatorPageHeader,
  KPIStatCard,
  PillButton,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { StatusBadge, type CoordinatorStatus } from '@/components/coordinator/StatusBadge'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  listInternships,
  listMyActivity,
  listNotifications,
  listOpportunities,
  listSemesters,
} from '@/lib/coordinator/api'
import { mapActivity } from '@/lib/coordinator/apiMappers'
import { formatDate } from '@/lib/utils'
import type {
  InternshipListItemResponse,
  NotificationResponse,
  OpportunityResponse,
  SemesterResponse,
} from '@/types/api'

interface AttentionItem {
  id: string
  title: string
  meta: string
  status: CoordinatorStatus
  date: string
  href: string
  action: string
}

interface PipelineStage {
  label: string
  count: number
  href: string
}

interface DashboardData {
  metrics: Array<{
    title: string
    value: number
    detail: string
    icon: typeof ClipboardCheck
    tone: 'red' | 'charcoal' | 'neutral'
  }>
  attention: AttentionItem[]
  pipeline: PipelineStage[]
  recent: Array<{
    title: string
    description: string
    time: string
    tone?: 'red' | 'charcoal' | 'neutral'
  }>
  semesters: SemesterResponse[]
  warnings: string[]
}

const emptyDashboard: DashboardData = {
  metrics: [
    {
      title: 'Pending Reviews',
      value: 0,
      detail: 'Confirmed placements',
      icon: ClipboardCheck,
      tone: 'neutral',
    },
    {
      title: 'Contract Review',
      value: 0,
      detail: 'Post-offer checks',
      icon: FileCheck2,
      tone: 'neutral',
    },
    {
      title: 'Active Opportunities',
      value: 0,
      detail: 'Published roles',
      icon: BriefcaseBusiness,
      tone: 'neutral',
    },
    {
      title: 'Students in Progress',
      value: 0,
      detail: 'Active workflows',
      icon: Users,
      tone: 'neutral',
    },
    { title: 'Notifications', value: 0, detail: 'Unread notices', icon: Bell, tone: 'neutral' },
  ],
  attention: [],
  pipeline: [
    { label: 'Placement Confirmed', count: 0, href: '/coordinator/jobs?stage=submitted' },
    { label: 'Documents Submitted', count: 0, href: '/coordinator/jobs?stage=documents' },
    { label: 'Contract Review', count: 0, href: '/coordinator/jobs?stage=verification' },
    { label: 'Final Approval', count: 0, href: '/coordinator/jobs?stage=review' },
    { label: 'Approved', count: 0, href: '/coordinator/jobs?stage=approved' },
    { label: 'Rejected', count: 0, href: '/coordinator/contracts?status=rejected' },
  ],
  recent: [],
  semesters: [],
  warnings: [],
}

export default function CoordinatorDashboardPage() {
  const dashboardResource = useCoordinatorApiResource(
    async () => {
      const [
        internshipsResult,
        opportunitiesResult,
        notificationsResult,
        activityResult,
        semestersResult,
      ] = await Promise.allSettled([
        listInternships({ limit: 100 }),
        listOpportunities({ limit: 100 }),
        listNotifications({ limit: 20 }),
        listMyActivity({ limit: 6 }),
        listSemesters({ limit: 10 }),
      ])

      const internships =
        internshipsResult.status === 'fulfilled'
          ? internshipsResult.value.items
          : ([] as InternshipListItemResponse[])
      const opportunities =
        opportunitiesResult.status === 'fulfilled'
          ? opportunitiesResult.value.items
          : ([] as OpportunityResponse[])
      const notifications =
        notificationsResult.status === 'fulfilled'
          ? notificationsResult.value
          : { items: [] as NotificationResponse[], nextPageToken: null, unreadCount: 0 }
      const activity = activityResult.status === 'fulfilled' ? activityResult.value.items : []
      const semesters = semestersResult.status === 'fulfilled' ? semestersResult.value.items : []

      const customOpportunities = opportunities.filter((item) => item.type === 'custom')
      const pendingReviews = customOpportunities.filter(
        (item) => item.status === 'pending_verification'
      )
      const contractVerifications = internships.filter(
        (item) => item.status === 'offer_pending_review'
      )
      const activeOpportunities = opportunities.filter((item) => item.status === 'published')
      const studentsInProgress = new Set(
        internships
          .filter((item) => item.status !== 'offer_approved' && item.status !== 'rejected')
          .map((item) => item.userId)
      ).size
      const notificationsUnread = notifications.unreadCount
      const changesRequested = internships.filter(
        (item) => item.status === 'offer_changes_requested'
      )
      const rejectedInternships = internships.filter((item) => item.status === 'rejected')
      const approvedRecords =
        internships.filter((item) => item.status === 'offer_approved').length +
        activeOpportunities.length
      const rejectedRecords =
        rejectedInternships.length +
        opportunities.filter((item) => item.status === 'rejected').length

      return {
        metrics: [
          {
            title: 'Pending Reviews',
            value: pendingReviews.length,
            detail: 'Confirmed placements',
            icon: ClipboardCheck,
            tone: pendingReviews.length > 0 ? 'red' : 'neutral',
          },
          {
            title: 'Contract Review',
            value: contractVerifications.length,
            detail: 'Post-offer checks',
            icon: FileCheck2,
            tone: contractVerifications.length > 0 ? 'red' : 'neutral',
          },
          {
            title: 'Active Opportunities',
            value: activeOpportunities.length,
            detail: 'Published roles',
            icon: BriefcaseBusiness,
            tone: 'charcoal',
          },
          {
            title: 'Students in Progress',
            value: studentsInProgress,
            detail: 'Active workflows',
            icon: Users,
            tone: 'charcoal',
          },
          {
            title: 'Notifications',
            value: notificationsUnread,
            detail: 'Unread notices',
            icon: Bell,
            tone: notificationsUnread > 0 ? 'red' : 'neutral',
          },
        ],
        attention: buildAttentionQueue(pendingReviews, contractVerifications, notifications.items),
        pipeline: [
          {
            label: 'Placement Confirmed',
            count: pendingReviews.length,
            href: '/coordinator/jobs?status=pending',
          },
          {
            label: 'Documents Submitted',
            count: changesRequested.length,
            href: '/coordinator/jobs?stage=documents',
          },
          {
            label: 'Contract Review',
            count: contractVerifications.length,
            href: '/coordinator/jobs?stage=verification',
          },
          {
            label: 'Final Approval',
            count: pendingReviews.length,
            href: '/coordinator/jobs?stage=review',
          },
          {
            label: 'Approved',
            count: approvedRecords,
            href: '/coordinator/jobs?stage=approved',
          },
          {
            label: 'Rejected',
            count: rejectedRecords,
            href: '/coordinator/jobs?stage=rejected',
          },
        ],
        recent: activity.map(mapActivity),
        semesters,
        warnings: [
          internshipsResult.status === 'rejected'
            ? 'Internship records are currently unavailable.'
            : null,
          opportunitiesResult.status === 'rejected'
            ? 'Opportunity records are currently unavailable.'
            : null,
          notificationsResult.status === 'rejected'
            ? 'Workflow notifications are currently unavailable.'
            : null,
          activityResult.status === 'rejected' ? 'Recent activity is currently unavailable.' : null,
          semestersResult.status === 'rejected'
            ? 'Semester records are currently unavailable.'
            : null,
        ].filter((item): item is string => Boolean(item)),
      } satisfies DashboardData
    },
    emptyDashboard,
    'dashboard',
    { emptyData: emptyDashboard }
  )
  const dashboard = dashboardResource.data

  if (dashboardResource.loading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <CoordinatorContentSkeleton title="Loading coordinator dashboard..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <DashboardHeader />

      {(dashboardResource.error || dashboard.warnings.length > 0) && (
        <SurfaceCard className="p-4">
          <div className="space-y-2 text-sm text-slate-600">
            {dashboardResource.error && (
              <p>{`Dashboard data unavailable: ${dashboardResource.error}`}</p>
            )}
            {dashboard.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        </SurfaceCard>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.metrics.map((metric) => (
          <KPIStatCard
            key={metric.title}
            title={metric.title}
            value={metric.value}
            detail={metric.detail}
            icon={metric.icon}
            tone={metric.tone}
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]">
        <div className="space-y-6">
          <NeedsAttentionQueue items={dashboard.attention} />
          <PipelineSnapshot stages={dashboard.pipeline} />
        </div>

        <div className="space-y-6">
          <SemesterSnapshot semesters={dashboard.semesters} />
          <RecentActivity items={dashboard.recent} />
        </div>
      </div>
    </div>
  )
}

function DashboardHeader() {
  return (
    <CoordinatorPageHeader
      eyebrow="Placement Operations"
      title="Coordinator Dashboard"
      description="Placement operations, approvals, and semester workflow overview."
      actions={
        <>
          <PillButton href="/coordinator/jobs" variant="secondary">
            Open pipeline
          </PillButton>
          <PillButton href="/coordinator/contracts">Verify contracts</PillButton>
        </>
      }
    />
  )
}

function NeedsAttentionQueue({ items }: { items: AttentionItem[] }) {
  return (
    <SurfaceCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Needs Attention</h2>
          <p className="text-sm text-slate-500">Coordinator actions waiting in the workflow.</p>
        </div>
        <Clock3 className="h-5 w-5 text-red-700" />
      </div>
      <div className="divide-y divide-slate-100">
        {items.length === 0 && (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No pending coordinator actions.
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-950">{item.title}</p>
                <StatusBadge status={item.status} />
              </div>
              <p className="mt-1 text-sm text-slate-500">{item.meta}</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {daysWaitingLabel(item.date)}
              </p>
            </div>
            <Link
              href={item.href}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-slate-950 px-3 text-sm font-bold text-white hover:bg-black"
            >
              {item.action}
            </Link>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}

function PipelineSnapshot({ stages }: { stages: PipelineStage[] }) {
  return (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Placement Processing</h2>
          <p className="mt-1 text-sm text-slate-500">
            Post-offer document, contract, and final approval distribution.
          </p>
        </div>
        <BriefcaseBusiness className="h-5 w-5 text-red-700" />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stages.map((stage) => (
          <Link
            key={stage.label}
            href={stage.href}
            className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-red-200 hover:bg-white"
          >
            <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {stage.label}
            </p>
            <p className="mt-3 text-3xl font-bold text-slate-950">{stage.count}</p>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  )
}

function RecentActivity({
  items,
}: {
  items: Array<{
    title: string
    description: string
    time: string
    tone?: 'red' | 'charcoal' | 'neutral'
  }>
}) {
  return (
    <SurfaceCard className="p-5">
      <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
      <div className="mt-4">
        {items.length > 0 ? (
          <TimelineFeed items={items} />
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No recent activity yet.
          </p>
        )}
      </div>
    </SurfaceCard>
  )
}

function SemesterSnapshot({ semesters }: { semesters: SemesterResponse[] }) {
  const visibleSemesters = semesters.slice(0, 3)

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Semester Snapshot</h2>
          <p className="mt-1 text-sm text-slate-500">Active and recent intake windows.</p>
        </div>
        <CalendarDays className="h-5 w-5 text-red-700" />
      </div>
      <div className="mt-4 space-y-3">
        {visibleSemesters.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
            No semester records available.
          </p>
        )}
        {visibleSemesters.map((semester) => (
          <div key={semester.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-950">{semester.displayName}</p>
              <StatusBadge status={semester.status === 'draft' ? 'pending' : semester.status} />
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {semester.enrolmentOpenAt && semester.enrolmentCloseAt
                ? `${formatDate(semester.enrolmentOpenAt)} to ${formatDate(semester.enrolmentCloseAt)}`
                : 'Enrollment window unavailable'}
            </p>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}

function buildAttentionQueue(
  pendingReviews: OpportunityResponse[],
  contractVerifications: InternshipListItemResponse[],
  notifications: NotificationResponse[]
): AttentionItem[] {
  return [
    ...pendingReviews.map((item) => ({
      id: `opportunity-${item.id}`,
      title: item.jobTitle,
      meta: `${item.submittedByUserId ?? 'Student'} - ${item.employerName}`,
      status: 'pending' as CoordinatorStatus,
      date: item.updatedAt ?? item.createdAt,
      href: `/coordinator/jobs/review?id=${encodeURIComponent(item.id)}`,
      action: 'Verify',
    })),
    ...contractVerifications.map((item) => ({
      id: `contract-${item.id}`,
      title: item.opportunityJobTitle,
      meta: `${item.userId} - ${item.opportunityEmployerName}`,
      status: 'pending' as CoordinatorStatus,
      date: item.lastSubmittedAt ?? item.createdAt,
      href: `/coordinator/contracts/review?id=${encodeURIComponent(item.id)}`,
      action: 'Verify',
    })),
    ...notifications
      .filter((item) => !item.readAt)
      .map((item) => ({
        id: `notification-${item.id}`,
        title: item.title,
        meta: item.body,
        status: 'flagged' as CoordinatorStatus,
        date: item.createdAt,
        href: notificationHref(item),
        action: 'Open',
      })),
  ]
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .slice(0, 8)
}

function notificationHref(notification: NotificationResponse) {
  if (notification.relatedInternshipId) {
    return `/coordinator/contracts/review?id=${encodeURIComponent(notification.relatedInternshipId)}`
  }
  if (notification.relatedOpportunityId) {
    return `/coordinator/jobs/review?id=${encodeURIComponent(notification.relatedOpportunityId)}`
  }
  return '/coordinator/notifications'
}

function daysWaitingLabel(date: string) {
  const ageMs = Date.now() - Date.parse(date)
  if (!Number.isFinite(ageMs) || ageMs < 0) return `Submitted ${formatDate(date)}`
  const days = Math.floor(ageMs / 86_400_000)
  if (days === 0) return 'Submitted today'
  if (days === 1) return 'Waiting 1 day'
  return `Waiting ${days} days`
}
