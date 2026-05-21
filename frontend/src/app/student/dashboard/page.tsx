'use client'

import { useEffect, useState } from 'react'
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
  AnalyticsStrip,
  CoordinatorPageHeader,
  KPIStatCard,
  PillButton,
  SurfaceCard,
} from '@/components/student/Premium'

import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { KpiCardSkeleton, Skeleton } from '@/components/ui/ContentSkeleton'
import { UsersService, InternshipsService, NotificationsService } from '@/lib/api/openapi-client'
import type {
  StudentUserResponse,
  InternshipListItemResponse,
  NotificationResponse,
} from '@/lib/api/openapi-client'

const kpiIcons = [Users, Clock3, Send, CheckCircle2, AlertTriangle] as const
const kpiTones = ['red', 'charcoal', 'neutral', 'red', 'red'] as const

export default function StudentDashboardPage() {
  const [user, setUser] = useState<StudentUserResponse | null>(null)
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [notifications, setNotifications] = useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [profileRes, internshipsRes, notifRes] = await Promise.all([
          UsersService.getMyProfile(),
          InternshipsService.listInternships(),
          NotificationsService.listNotifications('true', 5),
        ])

        if (profileRes.role === 'student') {
          setUser(profileRes)
        }
        setInternships(internshipsRes.items)
        setNotifications(notifRes.items)
        setUnreadCount(notifRes.unreadCount)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const total = internships.length
  const applied = internships.filter((i) => i.status === 'applied').length
  const pendingReview = internships.filter((i) => i.status === 'offer_pending_review').length
  const approved = internships.filter((i) => i.status === 'offer_approved').length
  const flagged = internships.filter((i) =>
    ['offer_changes_requested', 'rejected'].includes(i.status)
  ).length

  const kpis = [
    {
      title: 'My applications',
      value: total,
      detail: 'Total internship records',
      progress: total > 0 ? 100 : 0,
    },
    {
      title: 'Applied',
      value: applied,
      detail: 'Waiting for response',
      progress: total > 0 ? Math.round((applied / total) * 100) : 0,
    },
    {
      title: 'Offer submitted',
      value: pendingReview,
      detail: 'Pending coordinator review',
      progress: total > 0 ? Math.round((pendingReview / total) * 100) : 0,
    },
    {
      title: 'Approved',
      value: approved,
      detail: 'Offers approved',
      progress: total > 0 ? Math.round((approved / total) * 100) : 0,
    },
    {
      title: 'Needs attention',
      value: flagged,
      detail: 'Changes requested or rejected',
      progress: total > 0 ? Math.round((flagged / total) * 100) : 0,
    },
  ]

  const workflowStep = user?.currentWorkflowStep ?? 'profile'

  function internshipStatusToBadge(status: string): StudentStatus {
    const map: Record<string, StudentStatus> = {
      applied: 'applied',
      offer_pending_review: 'offer_pending_review',
      offer_changes_requested: 'offer_changes_requested',
      offer_approved: 'offer_approved',
      rejected: 'rejected',
    }
    return map[status] ?? 'applied'
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="Work Integrated Learning Cohort"
        description="Track internships, opportunities, and submissions in your student portal."
        actions={
          <>
            <PillButton href="/student/contracts" variant="secondary">
              View applications
            </PillButton>
            <PillButton href="/student/opportunities">Browse opportunities</PillButton>
          </>
        }
      />

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
            href: '/student/semesters',
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

      {loading && (
        <div className="space-y-6" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading dashboard…</span>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {[0, 1, 2, 3, 4].map((i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Skeleton className="h-5 w-48 bg-slate-200" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && (
        <>
          {/* KPI CARDS */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {kpis.map((metric, index) => {
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
                label: 'Active applications',
                value: String(applied + pendingReview),
                detail: 'Applied or pending review',
                tone: 'red',
              },
              {
                label: 'Approved offers',
                value: String(approved),
                detail: 'Confirmed placements',
                tone: 'charcoal',
              },
              {
                label: 'Unread notifications',
                value: String(unreadCount),
                detail: 'Requires your attention',
                tone: 'red',
              },
              {
                label: 'Workflow step',
                value: workflowStep.replace(/_/g, ' '),
                detail: 'Current stage',
                tone: 'neutral',
              },
            ]}
          />

          {/* MAIN GRID */}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,0.65fr)]">
            <div className="space-y-6">
              {/* RECENT INTERNSHIPS */}
              <SurfaceCard className="overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">My Applications</h2>
                    <p className="text-sm text-slate-500">Your recent internship applications.</p>
                  </div>

                  <Link
                    href="/student/contracts"
                    className="text-sm font-bold text-red-700 hover:text-red-800"
                  >
                    View all
                  </Link>
                </div>

                <div className="divide-y divide-slate-100">
                  {internships.length === 0 ? (
                    <div className="p-5 text-sm text-slate-500">No applications yet.</div>
                  ) : (
                    internships.slice(0, 5).map((internship) => (
                      <div key={internship.id} className="flex items-center gap-4 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-950">
                            {internship.opportunityJobTitle}
                          </p>
                          <p className="text-sm text-slate-500">
                            {internship.opportunityEmployerName}
                          </p>
                        </div>
                        <StatusBadge status={internshipStatusToBadge(internship.status)} />
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>

            {/* RIGHT COLUMN */}
            <div className="space-y-6">
              <SurfaceCard className="p-5">
                <p className="text-xs font-bold tracking-[0.18em] text-red-700 uppercase">
                  Workflow Step
                </p>
                <h2 className="mt-2 text-xl font-bold text-slate-950 capitalize">
                  {workflowStep.replace(/_/g, ' ')}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {user?.onboardingStage === 'profile_pending'
                    ? 'Complete your profile to unlock internship applications.'
                    : 'Your profile is ready. Explore opportunities and apply.'}
                </p>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-slate-950">{total}</p>
                    <p className="text-xs text-slate-500">Applications</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-lg font-bold text-slate-950">{approved}</p>
                    <p className="text-xs text-slate-500">Approved</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm font-bold text-slate-950">
                      {user?.studentProfile?.semesterId ? 'Enrolled' : 'None'}
                    </p>
                    <p className="text-xs text-slate-500">Semester</p>
                  </div>
                </div>
              </SurfaceCard>

              {/* NOTIFICATIONS */}
              <SurfaceCard className="p-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-950">Notifications</h2>
                  <Link
                    href="/student/notifications"
                    className="text-sm font-bold text-red-700 hover:text-red-800"
                  >
                    View all
                  </Link>
                </div>
                <div className="mt-4 space-y-3">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-slate-500">No unread notifications.</p>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className="flex gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div>
                          <p className="font-semibold">{notif.title}</p>
                          <p className="mt-0.5 text-xs text-red-700">{notif.body}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>

              {/* RECENT TIMELINE */}
              <SurfaceCard className="p-5">
                <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
                <div className="mt-4 space-y-2">
                  {internships.length === 0 ? (
                    <div className="text-sm text-slate-500">No recent activity yet.</div>
                  ) : (
                    internships.slice(0, 3).map((i) => (
                      <div key={i.id} className="flex items-center justify-between text-sm">
                        <span className="truncate text-slate-700">{i.opportunityEmployerName}</span>
                        <StatusBadge status={internshipStatusToBadge(i.status)} />
                      </div>
                    ))
                  )}
                </div>
              </SurfaceCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
