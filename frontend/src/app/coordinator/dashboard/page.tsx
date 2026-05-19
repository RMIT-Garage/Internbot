'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Send,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  AIInsightCard,
  AnalyticsStrip,
  CoordinatorPageHeader,
  KPIStatCard,
  PillButton,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { dashboardKpis } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import {
  listInternships,
  listMyActivity,
  listNotifications,
  listOpportunities,
} from '@/lib/coordinator/api'
import {
  buildPendingApprovals,
  mapActivity,
  mapInternshipToContractApproval,
  mapNotification,
  mapOpportunityToSelfSourcedJob,
} from '@/lib/coordinator/apiMappers'
import { formatDate } from '@/lib/utils'

const kpiIcons = [Users, Clock3, Send, CheckCircle2, AlertTriangle] as const
const kpiTones = ['charcoal', 'neutral', 'red', 'charcoal', 'red'] as const

export default function CoordinatorDashboardPage() {
  const dashboardResource = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/dashboard] backend filters: limit only; dashboard summaries are derived client-side'
        )
      }
      const [internshipsResult, opportunitiesResult, notificationsResult, activityResult] =
        await Promise.allSettled([
          listInternships({ limit: 100 }),
          listOpportunities({ limit: 100 }),
          listNotifications({ limit: 20 }),
          listMyActivity({ limit: 6 }),
        ])
      const internships =
        internshipsResult.status === 'fulfilled'
          ? internshipsResult.value
          : { items: [], nextPageToken: null }
      const opportunities =
        opportunitiesResult.status === 'fulfilled'
          ? opportunitiesResult.value
          : { items: [], nextPageToken: null }
      const notifications =
        notificationsResult.status === 'fulfilled'
          ? notificationsResult.value
          : { items: [], nextPageToken: null, unreadCount: 0 }
      const activity =
        activityResult.status === 'fulfilled'
          ? activityResult.value
          : { items: [], nextPageToken: null }
      const contracts = internships.items.map(mapInternshipToContractApproval)
      const jobs = opportunities.items
        .filter((item) => item.type === 'custom')
        .map(mapOpportunityToSelfSourcedJob)
      const approvals = buildPendingApprovals(jobs, contracts)
      const failedRequests = [
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
      ].filter((item): item is string => Boolean(item))
      const pendingContracts = contracts.filter((item) => item.status === 'pending').length
      const pendingJobs = jobs.filter((item) => item.status === 'pending').length
      const needsAttention = contracts.filter(
        (item) => item.status === 'changes_requested' || item.status === 'rejected'
      ).length

      return {
        approvals,
        recent: activity.items.map(mapActivity),
        approvalEmptyMessage:
          jobs.length + contracts.length === 0
            ? 'Backend connected, but no records exist yet.'
            : 'No placement reviews are pending coordinator action.',
        alerts: [
          `${pendingContracts} internship offers pending review.`,
          `${pendingJobs} placement reviews pending verification.`,
          `${notifications.unreadCount} unread workflow notifications.`,
          ...failedRequests,
        ],
        kpis: [
          {
            title: 'Total students',
            value: new Set(internships.items.map((item) => item.userId)).size,
            detail: 'Students with internship records',
            progress: 72,
          },
          {
            title: 'Looking',
            value: internships.items.filter((item) => item.status === 'applied').length,
            detail: 'Applied or sourcing',
            progress: 42,
          },
          {
            title: 'Applied',
            value: internships.items.length,
            detail: 'Internship workflow records',
            progress: 64,
          },
          {
            title: 'Accepted',
            value: internships.items.filter((item) => item.status === 'offer_approved').length,
            detail: 'Approved offers',
            progress: 36,
          },
          {
            title: 'Needs attention',
            value: needsAttention,
            detail: 'Rejected or changes requested',
            progress: 18,
          },
        ],
        notifications: notifications.items.map(mapNotification),
      }
    },
    {
      approvals: [],
      recent: [],
      approvalEmptyMessage: 'Dashboard data is unavailable.',
      alerts: ['Backend integration unavailable.'],
      kpis: dashboardKpis,
      notifications: [],
    },
    'dashboard',
    {
      emptyData: {
        approvals: [],
        recent: [],
        approvalEmptyMessage: 'Dashboard data is unavailable.',
        alerts: ['Workflow API returned an error. See console for response details.'],
        kpis: dashboardKpis.map((item) => ({ ...item, value: 0, progress: 0 })),
        notifications: [],
      },
    }
  )
  const dashboard = dashboardResource.data

  if (dashboardResource.loading) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Coordinator Hub"
          title="Work Integrated Learning Cohort"
          description="Semester 1 2026 review operations, approval queues, AI-assisted risk triage, and student workflow tracking."
          actions={
            <>
              <PillButton href="/coordinator/contracts?status=pending" variant="secondary">
                Review contracts
              </PillButton>
              <PillButton href="/coordinator/opportunities">Create opportunity</PillButton>
            </>
          }
        />
        <CoordinatorContentSkeleton title="Loading coordinator dashboard..." />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Coordinator Hub"
        title="Work Integrated Learning Cohort"
        description="Semester 1 2026 review operations, approval queues, AI-assisted risk triage, and student workflow tracking."
        actions={
          <>
            <PillButton href="/coordinator/contracts?status=pending" variant="secondary">
              Review contracts
            </PillButton>
            <PillButton href="/coordinator/opportunities">Create opportunity</PillButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboard.kpis.map((metric, index) => {
          const Icon = kpiIcons[index] ?? TrendingUp
          return (
            <KPIStatCard
              key={metric.title}
              title={metric.title}
              value={metric.value}
              detail={metric.detail}
              progress={metric.progress}
              icon={Icon}
              tone={kpiTones[index] ?? 'red'}
            />
          )
        })}
      </div>

      <AnalyticsStrip
        items={[
          {
            label: 'Queue velocity',
            value: '+18%',
            detail: 'Review throughput this week',
            tone: 'charcoal',
          },
          {
            label: 'AI risk cluster',
            value: '6',
            detail: 'Insurance and supervision flags',
            tone: 'red',
          },
          {
            label: 'Notifications sent',
            value: '42',
            detail: 'Automated student updates',
            tone: 'neutral',
          },
          {
            label: 'Advisor confidence',
            value: '92%',
            detail: 'Current workflow model',
            tone: 'charcoal',
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-6">
          {dashboardResource.error && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {`Using isolated fallback data: ${dashboardResource.error}`}
            </div>
          )}
          <AIInsightCard
            title="AI Insights"
            confidence={92}
            href="/coordinator/ai-advisor"
            insight="Contract reviews are trending 18% faster this week, but six submissions have institutional risk markers. Prioritise insurance clauses, remote supervision cadence, and weekly hour limits."
          />

          <SurfaceCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Placement Reviews</h2>
                <p className="text-sm text-slate-500">
                  Priority submissions requiring coordinator action.
                </p>
              </div>
              <Link
                href="/coordinator/contracts"
                className="text-sm font-bold text-red-700 hover:text-red-800"
              >
                View all
              </Link>
            </div>
            <div className="divide-y divide-slate-100">
              {dashboard.approvals.length === 0 && (
                <div className="px-5 py-10 text-center text-sm text-slate-500">
                  {dashboard.approvalEmptyMessage}
                </div>
              )}
              {dashboard.approvals.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-950">{item.studentName}</p>
                      <StatusBadge status="pending" />
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.type} submitted {formatDate(item.date)}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="text-sm font-bold text-red-700 hover:text-red-800"
                  >
                    Open review
                  </Link>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="space-y-6">
          <SurfaceCard className="p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">
              Current Phase
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Review and approvals</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Students are submitting placements and contracts. Coordinator focus is on evidence
              quality, compliance, and notification turnaround.
            </p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {['Week 8', '72%', '9 days'].map((item, index) => (
                <div key={item} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-950">{item}</p>
                  <p className="text-xs text-slate-500">
                    {index === 0 ? 'Semester' : index === 1 ? 'Complete' : 'Window'}
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="text-lg font-bold text-slate-950">Action Required</h2>
            <div className="mt-4 space-y-3">
              {dashboard.alerts.map((alert) => (
                <div
                  key={alert}
                  className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {alert}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
            <div className="mt-4">
              <TimelineFeed items={dashboard.recent} />
            </div>
          </SurfaceCard>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Pending contracts',
            href: '/coordinator/contracts?status=pending',
            icon: FileCheck2,
          },
          {
            title: 'Placement reviews',
            href: '/coordinator/jobs?status=pending',
            icon: BriefcaseBusiness,
          },
          { title: 'Student directory', href: '/coordinator/students', icon: Users },
        ].map(({ title, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon className="h-5 w-5 text-red-700" />
            <p className="mt-4 font-bold text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-500">Open workflow</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
