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
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import {
  actionAlerts,
  dashboardKpis,
  pendingApprovals,
  recentActivity,
} from '@/lib/coordinator/mockData'
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
const kpiTones = ['blue', 'amber', 'purple', 'green', 'red'] as const

export default function CoordinatorDashboardPage() {
  const dashboardResource = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/dashboard] backend filters: limit only; dashboard summaries are derived client-side'
        )
      }
      const [internships, opportunities, notifications, activity] = await Promise.all([
        listInternships({ limit: 100 }),
        listOpportunities({ limit: 100 }),
        listNotifications({ limit: 20 }),
        listMyActivity({ limit: 6 }),
      ])
      const contracts = internships.items.map(mapInternshipToContractApproval)
      const jobs = opportunities.items
        .filter((item) => item.type === 'custom')
        .map(mapOpportunityToSelfSourcedJob)
      const approvals = buildPendingApprovals(jobs, contracts)

      return {
        approvals,
        recent: activity.items.length ? activity.items.map(mapActivity) : recentActivity,
        alerts: [
          `${contracts.filter((item) => item.status === 'pending').length} internship offers pending review.`,
          `${jobs.filter((item) => item.status === 'pending').length} self-sourced roles pending verification.`,
          `${notifications.unreadCount} unread workflow notifications.`,
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
            title: 'Contracts flagged',
            value: contracts.filter((item) => item.status === 'flagged').length,
            detail: 'Rejected or high-risk offers',
            progress: 18,
          },
        ],
        notifications: notifications.items.map(mapNotification),
      }
    },
    {
      approvals: pendingApprovals,
      recent: recentActivity,
      alerts: actionAlerts,
      kpis: dashboardKpis,
      notifications: [],
    },
    'dashboard',
    {
      emptyData: {
        approvals: [],
        recent: [],
        alerts: ['Workflow API returned an error. See console for response details.'],
        kpis: dashboardKpis.map((item) => ({ ...item, value: 0, progress: 0 })),
        notifications: [],
      },
    }
  )
  const dashboard = dashboardResource.data

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
            tone: 'green',
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
            tone: 'blue',
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
          {(dashboardResource.loading || dashboardResource.error) && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {dashboardResource.loading
                ? 'Loading workflow data from internships, opportunities, notifications, and activity APIs...'
                : `Using isolated fallback data: ${dashboardResource.error}`}
            </div>
          )}
          <AIInsightCard
            title="AI Advisor Insights"
            confidence={92}
            href="/coordinator/ai-advisor"
            insight="Contract reviews are trending 18% faster this week, but six submissions have institutional risk markers. Prioritise insurance clauses, remote supervision cadence, and weekly hour limits."
          />

          <SurfaceCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Review Queue</h2>
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
              {dashboard.approvals.map((item) => (
                <div
                  key={item.id}
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              Current Phase
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Review and approvals</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Students are submitting self-sourced roles and contracts. Coordinator focus is on
              evidence quality, compliance, and notification turnaround.
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
            title: 'Self-sourced jobs',
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
