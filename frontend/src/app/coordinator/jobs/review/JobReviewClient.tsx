'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
  User,
} from 'lucide-react'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getOpportunity } from '@/lib/coordinator/api'
import { mapOpportunityToSelfSourcedJob } from '@/lib/coordinator/apiMappers'
import {
  recentActivity,
  type ApprovalStatus,
  type SelfSourcedJob,
  type WorkflowTone,
} from '@/lib/coordinator/mockData'
import { formatDate } from '@/lib/utils'
import type { OpportunityStatus } from '@/types/api'

export function JobReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [job, setJob] = useState<SelfSourcedJob | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState(recentActivity.slice(0, 3))
  const [backendStatus, setBackendStatus] = useState<OpportunityStatus | null>(null)

  useEffect(() => {
    let active = true

    if (!id) return

    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setError(null)
    })
    getOpportunity(id)
      .then((opportunity) => {
        if (!active) return
        setBackendStatus(opportunity.status)
        setJob(mapOpportunityToSelfSourcedJob(opportunity))
      })
      .catch((err: unknown) => {
        if (!active) return
        setJob(null)
        setError(
          err instanceof Error
            ? `Unable to load this job from the workflow API: ${err.message}`
            : 'Unable to load this job from the workflow API.'
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  if (!id) {
    return (
      <ReviewNotice
        title="Job review unavailable"
        message="No job was selected. Return to the queue and open a row from View Details."
      />
    )
  }

  if (loading) {
    return <ReviewNotice title="Loading job review" message="Fetching the selected opportunity." />
  }

  if (!job) {
    return (
      <ReviewNotice
        title="Job review unavailable"
        message={error ?? 'The selected job was not found in the workflow API.'}
      />
    )
  }

  const refreshJob = async () => {
    const opportunity = await getOpportunity(job.id)
    setBackendStatus(opportunity.status)
    setJob((current) => ({
      ...mapOpportunityToSelfSourcedJob(opportunity),
      notes: current?.notes ?? mapOpportunityToSelfSourcedJob(opportunity).notes,
    }))
  }

  const handleDecisionSuccess = (decision: ReviewDecision, notes: string) => {
    setJob((current) =>
      current
        ? {
            ...current,
            status: decisionToStatus(decision),
            notes: notes ? [notes, ...current.notes] : current.notes,
          }
        : current
    )
    setBackendStatus(decisionToJobBackendStatus(decision))
    setTimeline((current) => [
      {
        title: decisionToTimelineTitle(decision),
        description: notes || 'Coordinator decision submitted to the workflow API.',
        time: 'Just now',
        tone: decisionToTimelineTone(decision),
      },
      ...current,
    ])
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Placement Review"
        title={job.jobTitle}
        description={`${job.studentName} submitted ${job.company} for institutional approval.`}
        actions={<BackLink href="/coordinator/jobs">Back to queue</BackLink>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Internship Information</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted {formatDate(job.submissionDate)}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                [User, 'Student', `${job.studentName} (${job.studentId})`],
                [FileText, 'Course', job.course],
                [Clock3, 'Semester', job.semester],
                [Building2, 'Employer', job.company],
                [ShieldCheck, 'Supervisor', job.supervisor],
                [Clock3, 'Work pattern', job.workPattern],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof User
                return (
                  <div key={label as string} className="rounded-2xl bg-slate-50 p-4">
                    <DetailIcon className="h-4 w-4 text-red-700" />
                    <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      {label as string}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value as string}</p>
                  </div>
                )
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Submitted Role Description</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {job.description}
            </p>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Review Timeline</h2>
            <div className="mt-4">
              <TimelineFeed items={timeline} />
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <AIInsightCard
            title="AI Insights"
            confidence={job.aiConfidence ?? 88}
            insight={job.aiAdvisory}
          />

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Risk Analysis</h2>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Risk level</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{job.riskLevel ?? 'Low'}</p>
            </div>
            <div className="mt-4 space-y-2">
              {(job.concerns.length ? job.concerns : ['No concerns recorded.']).map((concern) => (
                <div
                  key={concern}
                  className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                  {concern}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Reviewer Notes
            </h2>
            <ReviewDecisionPanel
              id={job.id}
              kind="job"
              defaultNotes={job.notes.join('\n')}
              canReview={backendStatus === 'pending_verification'}
              reviewedStatus={job.status}
              backHref="/coordinator/jobs"
              onSuccess={handleDecisionSuccess}
              onAlreadyReviewed={refreshJob}
            />
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}

function decisionToJobBackendStatus(decision: ReviewDecision): OpportunityStatus {
  return decision === 'approved' ? 'published' : 'rejected'
}

function decisionToStatus(decision: ReviewDecision): ApprovalStatus {
  if (decision === 'approved') return 'approved'
  if (decision === 'rejected') return 'rejected'
  return 'changes_requested'
}

function decisionToTimelineTitle(decision: ReviewDecision): string {
  if (decision === 'approved') return 'Job approved'
  if (decision === 'rejected') return 'Job rejected'
  return 'Job changes requested'
}

function decisionToTimelineTone(decision: ReviewDecision): WorkflowTone {
  if (decision === 'approved') return 'charcoal'
  if (decision === 'rejected') return 'red'
  return 'neutral'
}

function ReviewNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Placement Review"
        title={title}
        description={message}
        actions={<BackLink href="/coordinator/jobs">Back to queue</BackLink>}
      />
    </div>
  )
}

function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
      href={href}
    >
      {children}
    </Link>
  )
}
