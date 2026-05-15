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
} from '@/components/student/Premium'

import { StatusBadge } from '@/components/student/StatusBadge'
import { formatDate } from '@/lib/utils'

const kpiIcons = [Users, Clock3, Send, CheckCircle2, AlertTriangle] as const
const kpiTones = ['blue', 'amber', 'purple', 'green', 'red'] as const

// ✅ SAFE FALLBACK DATA (replaces coordinator API)
const dashboardResource = {
  loading: false,
  error: null,
  data: {
    approvals: [],
    recent: [],
    alerts: ['Student dashboard is running in offline mode (API not connected yet).'],
    kpis: [
      {
        title: 'Total students',
        value: 0,
        detail: 'Students with internship records',
        progress: 0,
      },
      {
        title: 'Looking',
        value: 0,
        detail: 'Applied or sourcing',
        progress: 0,
      },
      {
        title: 'Applied',
        value: 0,
        detail: 'Internship workflow records',
        progress: 0,
      },
      {
        title: 'Accepted',
        value: 0,
        detail: 'Approved offers',
        progress: 0,
      },
      {
        title: 'Contracts flagged',
        value: 0,
        detail: 'Rejected or high-risk offers',
        progress: 0,
      },
    ],
    notifications: [],
  },
}

export default function StudentDashboardPage() {
  const dashboard = dashboardResource.data

  return (
    <div className="space-y-6">
      {/* HEADER (unchanged design) */}
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="Work Integrated Learning Cohort"
        description="Track internships, opportunities, and submissions in your student portal."
        actions={
          <>
            <PillButton href="/student/contracts" variant="secondary">
              View contracts
            </PillButton>
            <PillButton href="/student/opportunities">Browse opportunities</PillButton>
          </>
        }
      />

      {/* KPI CARDS */}
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

      {/* ANALYTICS STRIP */}
      <AnalyticsStrip
        items={[
          {
            label: 'Queue velocity',
            value: '+12%',
            detail: 'Student activity trend',
            tone: 'green',
          },
          {
            label: 'Active applications',
            value: '0',
            detail: 'Current submissions',
            tone: 'blue',
          },
          {
            label: 'Notifications',
            value: '0',
            detail: 'Unread updates',
            tone: 'purple',
          },
          {
            label: 'Progress score',
            value: '0%',
            detail: 'Overall completion',
            tone: 'charcoal',
          },
        ]}
      />

      {/* MAIN GRID */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
        <div className="space-y-6">
          {/* INFO BANNER */}
          {(dashboardResource.loading || dashboardResource.error) && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {dashboardResource.loading
                ? 'Loading student dashboard...'
                : `Using fallback data: ${dashboardResource.error}`}
            </div>
          )}

          {/* INSIGHT CARD */}
          <AIInsightCard
            title="AI Student Insights"
            confidence={85}
            href="/student/ai-advisor"
            insight="Focus on completing profile and applying to active internships to improve match score and visibility."
          />

          {/* REVIEW QUEUE */}
          <SurfaceCard className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Your Activity</h2>
                <p className="text-sm text-slate-500">Recent student actions and submissions.</p>
              </div>

              <Link
                href="/student/opportunities"
                className="text-sm font-bold text-red-700 hover:text-red-800"
              >
                View opportunities
              </Link>
            </div>

            <div className="p-5 text-sm text-slate-500">No activity yet.</div>
          </SurfaceCard>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          <SurfaceCard className="p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">
              Current Phase
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-950">Student onboarding</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Set up your profile, explore opportunities, and begin internship applications.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              {['Week 1', '0%', 'Open'].map((item, index) => (
                <div key={item} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-950">{item}</p>
                  <p className="text-xs text-slate-500">
                    {index === 0 ? 'Semester' : index === 1 ? 'Complete' : 'Status'}
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          {/* ALERTS */}
          <SurfaceCard className="p-5">
            <h2 className="text-lg font-bold text-slate-950">Notifications</h2>
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

          {/* TIMELINE */}
          <SurfaceCard className="p-5">
            <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
            <div className="mt-4 text-sm text-slate-500">No recent activity yet.</div>
          </SurfaceCard>
        </div>
      </div>

      {/* QUICK LINKS */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: 'Browse internships',
            href: '/student/opportunities',
            icon: BriefcaseBusiness,
          },
          {
            title: 'My applications',
            href: '/student/contracts',
            icon: FileCheck2,
          },
          {
            title: 'Profile setup',
            href: '/student/profile',
            icon: Users,
          },
        ].map(({ title, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <Icon className="h-5 w-5 text-red-700" />
            <p className="mt-4 font-bold text-slate-950">{title}</p>
            <p className="mt-1 text-sm text-slate-500">Open</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
