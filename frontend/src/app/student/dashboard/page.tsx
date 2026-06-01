'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Send,
  XCircle,
  UserCircle2,
  ChevronRight,
  Bell,
  BrainCircuit,
  FileText,
} from 'lucide-react'

import { CoordinatorPageHeader, PillButton, SurfaceCard } from '@/components/student/Premium'
import { PlacementConfirmedBanner } from '@/components/student/PlacementConfirmedBanner'
import { StudentDashboardStatusCard } from '@/components/student/StudentDashboardStatusCard'

import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import {
  UsersService,
  InternshipsService,
  NotificationsService,
  SemestersService,
} from '@/lib/api/openapi-client'
import type {
  StudentUserResponse,
  InternshipListItemResponse,
  NotificationResponse,
  SemesterResponse,
} from '@/lib/api/openapi-client'
import type { UserWorkflowResponse } from '@/api/models/UserWorkflowResponse'
import { deriveStudentDashboardStatus } from '@/lib/semester/display'
import {
  filterInternshipsForDashboard,
  findApprovedInternship,
  placementSemesterLabelFromInternship,
  resolveEffectiveSemesterId,
} from '@/lib/student/semesterContext'

// ── Profile-incomplete dashboard ─────────────────────────────────────────────

function IncompleteProfileDashboard({
  notifications,
  unreadCount,
}: {
  notifications: NotificationResponse[]
  unreadCount: number
}) {
  const steps = [
    { label: 'Personal details', href: '/onboarding/personal' },
    { label: 'Academic info', href: '/onboarding/academic' },
    { label: 'Credit selection', href: '/onboarding/credits' },
    { label: 'Review & submit', href: '/onboarding/review' },
  ]

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="Welcome to Internbot"
        description="Finish setting up your profile to access internship opportunities and contracts."
      />

      {/* COMPLETE PROFILE CALL-TO-ACTION */}
      <div className="overflow-hidden rounded-2xl border border-red-200 bg-red-50 shadow-sm">
        <div className="flex items-start gap-4 p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100">
            <UserCircle2 className="h-6 w-6 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-red-900">Complete your profile</h2>
            <p className="mt-1 text-sm leading-6 text-red-700">
              Your profile is incomplete. You&apos;ll be able to browse opportunities, submit
              contracts, and access all features once you&apos;re done.
            </p>
            <Link
              href="/student/semesters"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700"
            >
              Set up my profile
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* STEPS */}
        <div className="border-t border-red-200 px-6 py-4">
          <p className="mb-3 text-xs font-bold tracking-[0.15em] text-red-600 uppercase">
            Setup steps
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(({ label }) => (
              <div
                key={label}
                className="flex items-center gap-2 rounded-lg bg-red-100/60 px-3 py-2"
              >
                <div className="h-2 w-2 shrink-0 rounded-full bg-red-400" />
                <span className="text-xs font-medium text-red-800">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AVAILABLE FEATURES */}
      <div>
        <p className="mb-3 text-sm font-bold text-slate-500">Available while you set up</p>
        <div className="grid gap-4 md:grid-cols-2">
          {/* NOTIFICATIONS */}
          <SurfaceCard className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-700" />
                <h2 className="text-base font-bold text-slate-950">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="inline-flex h-5 items-center rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">
                    {unreadCount}
                  </span>
                )}
              </div>
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

          {/* ADVISOR */}
          <SurfaceCard className="p-5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-red-700" />
              <h2 className="text-base font-bold text-slate-950">AI Advisor</h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Get guidance on your internship journey — even before your profile is complete.
            </p>
            <Link
              href="/student/advisor"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:text-red-800"
            >
              Open Advisor <ChevronRight className="h-4 w-4" />
            </Link>
          </SurfaceCard>
        </div>
      </div>

      {/* LOCKED FEATURES PREVIEW */}
      <div>
        <p className="mb-3 text-sm font-bold text-slate-400">Unlocked after profile setup</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              title: 'Browse opportunities',
              icon: BriefcaseBusiness,
              description: 'Find internships that match your program.',
            },
            {
              title: 'My applications',
              icon: FileCheck2,
              description: 'Track and manage your internship contracts.',
            },
            {
              title: 'Self-sourced internships',
              icon: Send,
              description: 'Submit an internship you found yourself.',
            },
          ].map(({ title, icon: Icon, description }) => (
            <div
              key={title}
              className="relative overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 opacity-60"
            >
              <Icon className="h-5 w-5 text-slate-300" />
              <p className="mt-3 font-bold text-slate-400">{title}</p>
              <p className="mt-1 text-xs text-slate-400">{description}</p>
              <div className="absolute top-3 right-3">
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  🔒 Locked
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Full dashboard ────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const { profile, loading: authLoading } = useAuth()
  const [user, setUser] = useState<StudentUserResponse | null>(null)
  const [semester, setSemester] = useState<SemesterResponse | null>(null)
  const [workflow, setWorkflow] = useState<UserWorkflowResponse | null>(null)
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [approvedPlacement, setApprovedPlacement] = useState<InternshipListItemResponse | null>(
    null
  )
  const [notifications, setNotifications] = useState<NotificationResponse[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !profile) return

    const loadData = async () => {
      try {
        setLoading(true)
        const [profileRes, notifRes] = await Promise.all([
          UsersService.getMyProfile(),
          NotificationsService.listNotifications('true', 5),
        ])

        if (profileRes.role === 'student') {
          setUser(profileRes)
        }
        setNotifications(notifRes.items)
        setUnreadCount(notifRes.unreadCount)

        // Only fetch internships if profile is complete
        const isComplete =
          profileRes.role === 'student' &&
          (profileRes.onboardingStage === 'profile_complete' ||
            profileRes.studentProfile?.profileStatus === 'complete')

        if (isComplete) {
          const profileSemesterId =
            profileRes.role === 'student' ? profileRes.studentProfile?.semesterId : null
          const [internshipsRes, workflowRes] = await Promise.all([
            InternshipsService.listInternships(),
            UsersService.getMyWorkflow().catch(() => null),
          ])
          const allInternships = internshipsRes.items
          const effectiveSemesterId = resolveEffectiveSemesterId(profileSemesterId, allInternships)
          const semesterRes = effectiveSemesterId
            ? await SemestersService.getSemester(effectiveSemesterId).catch(() => null)
            : null
          setWorkflow(workflowRes)
          setSemester(semesterRes)
          const approved = findApprovedInternship(allInternships)
          setApprovedPlacement(approved)
          setInternships(filterInternshipsForDashboard(allInternships, effectiveSemesterId))
        } else {
          setWorkflow(null)
          setSemester(null)
          setApprovedPlacement(null)
          setInternships([])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [authLoading, profile])

  const profileComplete =
    user?.onboardingStage === 'profile_complete' ||
    user?.studentProfile?.profileStatus === 'complete'

  const total = internships.length
  const applied = internships.filter((i) => i.status === 'applied').length
  const pendingReview = internships.filter((i) => i.status === 'offer_pending_review').length
  const approved = internships.filter((i) => i.status === 'offer_approved').length
  const approvedInternship = approvedPlacement
  const placementSemesterLabel = placementSemesterLabelFromInternship(approvedPlacement)
  const flagged = internships.filter((i) =>
    ['offer_changes_requested', 'rejected'].includes(i.status)
  ).length

  const workflowStep = workflow?.currentWorkflowStep ?? user?.currentWorkflowStep ?? 'profile'
  const dashboardStatus = deriveStudentDashboardStatus({
    semester,
    workflow,
    currentWorkflowStep: workflowStep,
    appliedCount: applied,
    pendingReviewCount: pendingReview,
    placementSemesterLabel,
  })

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

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading dashboard…</span>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-black/10 bg-white p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-8" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <Skeleton className="h-5 w-40 bg-slate-200" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="divide-y divide-slate-100">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/5 bg-slate-200" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32 bg-slate-200" />
              <Skeleton className="h-3 w-12" />
            </div>
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 rounded-xl bg-slate-50" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  // Show restricted dashboard when profile is not complete
  if (!profileComplete) {
    return <IncompleteProfileDashboard notifications={notifications} unreadCount={unreadCount} />
  }

  // ── Full dashboard (profile complete) ──────────────────────────────────────
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Hub"
        title="My Dashboard"
        description={dashboardStatus.detail}
        actions={
          <>
            <PillButton href="/student/applications" variant="secondary">
              My applications
            </PillButton>
            <PillButton href="/student/opportunities">
              {approvedInternship ? 'View opportunities' : 'Browse opportunities'}
            </PillButton>
          </>
        }
      />

      <StudentDashboardStatusCard
        loading={loading}
        semester={semester}
        workflow={workflow}
        currentWorkflowStep={workflowStep}
        appliedCount={applied}
        pendingReviewCount={pendingReview}
        placementSemesterLabel={placementSemesterLabel}
      />

      {approvedInternship && (
        <PlacementConfirmedBanner internship={approvedInternship} semester={semester} />
      )}

      {/* KPI ROW */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
            <Clock3 className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">Applied</p>
            <p className="text-xl leading-tight font-bold text-gray-900">{applied}</p>
            <p className="text-[11px] text-gray-400">Awaiting response</p>
          </div>
        </SurfaceCard>
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <FileText className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
              Under review
            </p>
            <p className="text-xl leading-tight font-bold text-red-600">{pendingReview}</p>
            <p className="text-[11px] text-gray-400">With coordinator</p>
          </div>
        </SurfaceCard>
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50">
            <CheckCircle2 className="h-4 w-4 text-red-500" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
              Approved
            </p>
            <p className="text-xl leading-tight font-bold text-red-600">{approved}</p>
            <p className="text-[11px] text-gray-400">Confirmed placements</p>
          </div>
        </SurfaceCard>
        <SurfaceCard className="flex items-center gap-3 p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100">
            <XCircle className="h-4 w-4 text-gray-500" />
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-gray-400 uppercase">
              Needs action
            </p>
            <p className="text-xl leading-tight font-bold text-gray-900">{flagged}</p>
            <p className="text-[11px] text-gray-400">Changes or rejected</p>
          </div>
        </SurfaceCard>
      </div>

      {/* MAIN GRID */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        {/* Applications list */}
        <SurfaceCard className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-slate-950">My Applications</h2>
              <p className="text-xs text-slate-500">
                {total} record{total === 1 ? '' : 's'} for{' '}
                {semester ? 'your selected semester' : 'all semesters'}
              </p>
            </div>
            <Link
              href="/student/applications"
              className="text-sm font-bold text-red-700 hover:text-red-800"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {internships.length === 0 ? (
              <div className="p-5 text-sm text-slate-500">No applications yet.</div>
            ) : (
              internships.slice(0, 6).map((internship) => (
                <div key={internship.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {internship.opportunityJobTitle}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {internship.opportunityEmployerName}
                    </p>
                    {internship.semesterDisplayName && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        {internship.semesterDisplayName}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={internshipStatusToBadge(internship.status)} />
                </div>
              ))
            )}
          </div>
        </SurfaceCard>

        {/* Notifications */}
        <SurfaceCard className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-red-600" />
              <h2 className="text-base font-bold text-slate-950">Notifications</h2>
              {unreadCount > 0 && (
                <span className="inline-flex h-5 items-center rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">
                  {unreadCount}
                </span>
              )}
            </div>
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
      </div>
    </div>
  )
}
