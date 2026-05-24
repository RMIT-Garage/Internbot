'use client'

import Link from 'next/link'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  Circle,
  CircleDot,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  MessageSquareText,
  Paperclip,
  ShieldCheck,
  User,
} from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getOpportunity, getOpportunityAttachment, getUser } from '@/lib/coordinator/api'
import { mapOpportunityToSelfSourcedJob } from '@/lib/coordinator/apiMappers'
import { type ApprovalStatus, type SelfSourcedJob } from '@/lib/coordinator/mockData'
import { getReviewBackHref } from '@/lib/coordinator/reviewRouting'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'
import type { OpportunityAttachmentResponse, OpportunityStatus } from '@/types/api'

export function JobReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const backHref = getReviewBackHref(searchParams, '/coordinator/opportunities?tab=self-sourced')
  const [job, setJob] = useState<SelfSourcedJob | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<OpportunityStatus | null>(null)
  const [attachments, setAttachments] = useState<OpportunityAttachmentResponse[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [studentOwnerLabel, setStudentOwnerLabel] = useState(STUDENT_PROFILE_PENDING)

  useEffect(() => {
    let active = true

    if (!id) return

    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setError(null)
    })
    getOpportunity(id)
      .then(async (opportunity) => {
        if (!active) return
        setBackendStatus(opportunity.status)
        const mappedJob = mapOpportunityToSelfSourcedJob(opportunity)
        const ownerLabel = await resolveStudentOwnerLabel(opportunity.submittedByUserId)
        if (!active) return
        setStudentOwnerLabel(ownerLabel)
        setJob({
          ...mappedJob,
          studentName: ownerLabel,
          studentId: ownerLabel,
        })
        setAttachments(opportunity.attachments)
      })
      .catch((err: unknown) => {
        if (!active) return
        setJob(null)
        setError(
          err instanceof Error
            ? `Unable to load this placement review: ${err.message}`
            : 'Unable to load this placement review.'
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
        backHref={backHref}
      />
    )
  }

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading job review…" />
  }

  if (!job) {
    return (
      <ReviewNotice
        title="Job review unavailable"
        message={error ?? 'The selected placement review was not found.'}
        backHref={backHref}
      />
    )
  }

  const refreshJob = async () => {
    const opportunity = await getOpportunity(job.id)
    const ownerLabel = await resolveStudentOwnerLabel(opportunity.submittedByUserId)
    setBackendStatus(opportunity.status)
    setAttachments(opportunity.attachments)
    setStudentOwnerLabel(ownerLabel)
    setJob((current) => ({
      ...mapOpportunityToSelfSourcedJob(opportunity),
      studentName: ownerLabel,
      studentId: ownerLabel,
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
  }
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Placement Review"
        title={job.jobTitle}
        description={`Submitted by: ${studentOwnerLabel}. Employer: ${job.company}.`}
        actions={<BackLink href={backHref}>Back to queue</BackLink>}
      />

      <CaseHeader
        title={job.jobTitle}
        student={job.studentName}
        studentId={job.studentId}
        employer={job.company}
        status={job.status}
        submittedAt={job.submissionDate}
        canReview={backendStatus === 'pending_verification'}
        reviewer="Coordinator queue"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Placement Case Details</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Core record used for institutional placement assessment.
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                [User, 'Student', formatStudentLine(job.studentName, job.studentId)],
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
            <h2 className="text-lg font-bold text-slate-950">Submitted Placement Details</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {job.description}
            </p>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <Paperclip className="h-5 w-5 text-red-700" />
              Documents and Attachments
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Uploaded contracts, position descriptions, or supporting placement documents.
            </p>
            <AttachmentList
              attachments={attachments}
              error={attachmentError}
              onOpen={async (attachment, mode) => {
                setAttachmentError(null)
                try {
                  const download = await getOpportunityAttachment(job.id, attachment.id)
                  openAttachment(download.downloadUrl, mode)
                } catch (error) {
                  setAttachmentError(
                    error instanceof Error
                      ? `Unable to open attachment: ${error.message}`
                      : 'Unable to open attachment.'
                  )
                }
              }}
            />
          </SurfaceCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Review Decision
            </h2>
            <ReviewDecisionPanel
              id={job.id}
              kind="job"
              defaultNotes={job.notes.join('\n')}
              canReview={backendStatus === 'pending_verification'}
              reviewedStatus={job.status}
              backHref={backHref}
              onSuccess={handleDecisionSuccess}
              onAlreadyReviewed={refreshJob}
            />
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}

function AttachmentList({
  attachments,
  error,
  onOpen,
}: {
  attachments: OpportunityAttachmentResponse[]
  error: string | null
  onOpen: (attachment: OpportunityAttachmentResponse, mode: 'view' | 'download') => Promise<void>
}) {
  if (attachments.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
        No documents submitted.
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
          {error}
        </div>
      )}
      {attachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-red-700 ring-1 ring-slate-200">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-950">
                {attachment.fileName ?? 'Submitted attachment'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {attachment.contentType ?? 'File type pending'} - Uploaded{' '}
                {formatDate(attachment.uploadedAt)} by student
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void onOpen(attachment, 'view')}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View
            </button>
            <button
              type="button"
              onClick={() => void onOpen(attachment, 'download')}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white hover:bg-black"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function openAttachment(url: string, mode: 'view' | 'download') {
  if (mode === 'view') {
    window.open(url, '_blank', 'noopener,noreferrer')
    return
  }

  const link = document.createElement('a')
  link.href = url
  link.download = ''
  document.body.appendChild(link)
  link.click()
  link.remove()
}

async function resolveStudentOwnerLabel(userId: string | null) {
  if (!userId) return STUDENT_PROFILE_PENDING
  try {
    const user = await getUser(userId)
    return formatStudentDisplay(user)
  } catch {
    return STUDENT_PROFILE_PENDING
  }
}

function formatStudentLine(student: string, studentId: string) {
  if (!studentId || studentId === student || studentId === STUDENT_PROFILE_PENDING) return student
  return `${student} (${studentId})`
}

function CaseHeader({
  title,
  student,
  studentId,
  employer,
  status,
  submittedAt,
  canReview,
  reviewer,
}: {
  title: string
  student: string
  studentId: string
  employer: string
  status: ApprovalStatus
  submittedAt: string
  canReview: boolean
  reviewer: string
}) {
  const age = getAgeDays(submittedAt)
  return (
    <SurfaceCard className="p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {canReview ? 'Action required' : 'Decision completed'}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">{title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {formatStudentLine(student, studentId)} - {employer}
          </p>
          <WorkflowProgress status={status} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Case owner</p>
          <p className="mt-1 font-bold text-slate-950">{reviewer}</p>
          <p className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Last updated
          </p>
          <p className="mt-1 font-semibold text-slate-800">{formatDate(submittedAt)}</p>
          <p className="mt-4 text-xs font-bold tracking-wide text-slate-500 uppercase">
            Submission age
          </p>
          <p className="mt-1 font-semibold text-slate-800">
            {age === 0 ? 'Confirmed today' : `${age} day${age === 1 ? '' : 's'}`}
          </p>
        </div>
      </div>
    </SurfaceCard>
  )
}

function WorkflowProgress({ status }: { status: ApprovalStatus }) {
  const steps = getWorkflowSteps(status)
  const completedCount = getCompletedStepCount(status)

  return (
    <div className="mt-6 grid grid-cols-[repeat(5,minmax(0,1fr))]">
      {steps.map((step, index) => {
        const complete = index < completedCount
        const rejected = step.id === 'rejected' && step.current
        return (
          <div key={step.id} className="relative flex flex-col items-center gap-2 text-center">
            {index > 0 && (
              <div
                className={[
                  'absolute top-3 right-1/2 left-0 h-0.5',
                  index <= completedCount - 1 ? 'bg-slate-950' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
            {index < steps.length - 1 && (
              <div
                className={[
                  'absolute top-3 right-0 left-1/2 h-0.5',
                  index < completedCount - 1 ? 'bg-slate-950' : 'bg-slate-200',
                ].join(' ')}
              />
            )}
            <span
              className={[
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-white',
                rejected
                  ? 'border-red-700 bg-red-700 text-white'
                  : complete
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : step.current
                      ? 'border-red-700 text-red-700 ring-2 ring-red-100'
                      : 'border-slate-300 text-slate-400',
              ].join(' ')}
            >
              {complete ? (
                <CheckCircle2 className="h-3 w-3" />
              ) : step.current ? (
                <CircleDot className="h-3 w-3" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
            </span>
            <span className="text-[11px] font-bold text-slate-700">{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function getWorkflowSteps(status: ApprovalStatus) {
  const terminal = status === 'rejected' ? 'rejected' : 'approved'
  let current:
    | 'none'
    | 'submitted'
    | 'documents'
    | 'review'
    | 'verification'
    | 'approved'
    | 'rejected' = 'review'
  if (status === 'changes_requested' || status === 'awaiting_documents') current = 'documents'
  if (status === 'awaiting_contract_details') current = 'none'
  if (status === 'awaiting_contract_review') current = 'verification'
  if (
    status === 'flagged' ||
    status === 'awaiting_review' ||
    status === 'awaiting_placement_approval' ||
    status === 'awaiting_approval'
  )
    current = 'review'
  if (status === 'approved') current = 'approved'
  if (status === 'rejected') current = 'rejected'
  const currentStep = current as string

  return [
    { id: 'submitted', label: 'Placement Confirmed', current: currentStep === 'submitted' },
    { id: 'documents', label: 'Documents Submitted', current: currentStep === 'documents' },
    { id: 'verification', label: 'Contract Review', current: currentStep === 'verification' },
    { id: 'review', label: 'Placement Approval', current: currentStep === 'review' },
    {
      id: terminal,
      label: terminal === 'approved' ? 'Approved' : 'Rejected',
      current: currentStep === terminal,
    },
  ]
}

function getAgeDays(date: string) {
  const diff = Date.now() - Date.parse(date)
  if (!Number.isFinite(diff) || diff < 0) return 0
  return Math.floor(diff / 86_400_000)
}

function decisionToJobBackendStatus(decision: ReviewDecision): OpportunityStatus {
  return decision === 'approved' ? 'published' : 'rejected'
}

function decisionToStatus(decision: ReviewDecision): ApprovalStatus {
  if (decision === 'approved') return 'awaiting_contract_details'
  if (decision === 'rejected') return 'rejected'
  return 'changes_requested'
}

function getCompletedStepCount(status: ApprovalStatus) {
  if (status === 'awaiting_contract_details') return 1
  if (status === 'changes_requested' || status === 'awaiting_documents') return 1
  if (status === 'awaiting_contract_review') return 2
  if (status === 'approved') return 5
  if (status === 'rejected') return 0
  return 0
}

function ReviewNotice({
  title,
  message,
  backHref = '/coordinator/opportunities?tab=self-sourced',
}: {
  title: string
  message: string
  backHref?: string
}) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Placement Review"
        title={title}
        description={message}
        actions={<BackLink href={backHref}>Back to queue</BackLink>}
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
