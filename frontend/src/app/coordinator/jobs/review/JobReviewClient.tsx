'use client'

import Link from 'next/link'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2,
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
import { WorkflowStepper, buildWorkflowStepItems } from '@/components/coordinator/WorkflowStepper'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getOpportunity, getOpportunityAttachment, getUser } from '@/lib/coordinator/api'
import { mapOpportunityToSelfSourcedJob } from '@/lib/coordinator/apiMappers'
import { type ApprovalStatus, type SelfSourcedJob } from '@/lib/coordinator/mockData'
import { getReviewBackHref, SELF_SOURCED_REVIEW_CONTEXT } from '@/lib/coordinator/reviewRouting'
import { useJobCheck } from '@/features/coordinator-ai/hooks/useJobCheck'
import { CheckerResultPanel } from '@/features/coordinator-ai/components/CheckerResultPanel'
import type { CheckerInput } from '@/features/coordinator-ai/types'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'
import type { OpportunityAttachmentResponse, OpportunityStatus } from '@/types/api'

export function JobReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const context = searchParams.get('context')
  const backHref = getReviewBackHref(searchParams, '/coordinator/opportunities?tab=self-sourced')
  const [job, setJob] = useState<SelfSourcedJob | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<OpportunityStatus | null>(null)
  const [attachments, setAttachments] = useState<OpportunityAttachmentResponse[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [studentOwnerLabel, setStudentOwnerLabel] = useState(STUDENT_PROFILE_PENDING)
  const [checkerInput, setCheckerInput] = useState<CheckerInput | null>(null)
  const jobCheck = useJobCheck(checkerInput)

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
        const jobData = { ...mappedJob, studentName: ownerLabel, studentId: ownerLabel }
        setJob(jobData)
        setAttachments(opportunity.attachments)
        const userInput = `Job Title: ${mappedJob.jobTitle}\nEmployer: ${mappedJob.company}\nDescription: ${mappedJob.description}\nWork Pattern: ${mappedJob.workPattern}`
        const primaryAttachment = opportunity.attachments[0]
        if (primaryAttachment) {
          try {
            const { downloadUrl } = await getOpportunityAttachment(id, primaryAttachment.id)
            const resp = await fetch(downloadUrl)
            const buffer = await resp.arrayBuffer()
            const dataBase64 = arrayBufferToBase64(buffer)
            if (active)
              setCheckerInput({
                userInput,
                attachment: {
                  mimeType: primaryAttachment.contentType ?? 'application/octet-stream',
                  dataBase64,
                  fileName: primaryAttachment.fileName ?? undefined,
                },
              })
          } catch {
            if (active) setCheckerInput({ userInput })
          }
        } else {
          if (active) setCheckerInput({ userInput })
        }
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

  const isSuitabilityApprovalReview =
    context === SELF_SOURCED_REVIEW_CONTEXT ||
    backendStatus === 'pending_verification' ||
    job.status === 'awaiting_placement_approval'

  const canSuitabilityReview = backendStatus === 'pending_verification'

  if (isSuitabilityApprovalReview) {
    return (
      <SuitabilityApprovalReview
        job={job}
        studentOwnerLabel={studentOwnerLabel}
        backHref={backHref}
        attachments={attachments}
        attachmentError={attachmentError}
        canReview={canSuitabilityReview}
        jobCheck={jobCheck}
        onAttachmentOpen={async (attachment, mode) => {
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
        onDecisionSuccess={handleDecisionSuccess}
        onAlreadyReviewed={refreshJob}
      />
    )
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
        canReview={false}
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
            <CheckerResultPanel
              result={jobCheck.result}
              isLoading={jobCheck.isLoading}
              error={jobCheck.error}
              feature="job-checker"
            />
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Review Decision
            </h2>
            <ReviewDecisionPanel
              id={job.id}
              kind="job"
              defaultNotes={job.notes.join('\n')}
              canReview={false}
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

function SuitabilityApprovalReview({
  job,
  studentOwnerLabel,
  backHref,
  attachments,
  attachmentError,
  canReview,
  jobCheck,
  onAttachmentOpen,
  onDecisionSuccess,
  onAlreadyReviewed,
}: {
  job: SelfSourcedJob
  studentOwnerLabel: string
  backHref: string
  attachments: OpportunityAttachmentResponse[]
  attachmentError: string | null
  canReview: boolean
  jobCheck: {
    result: import('@/features/coordinator-ai/types').CheckerResponse | null
    isLoading: boolean
    error: string | null
  }
  onAttachmentOpen: (
    attachment: OpportunityAttachmentResponse,
    mode: 'view' | 'download'
  ) => Promise<void>
  onDecisionSuccess: (decision: ReviewDecision, notes: string) => void
  onAlreadyReviewed: () => Promise<void>
}) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Self-Sourced Opportunity Review"
        title={job.jobTitle}
        description={`Submitted by: ${studentOwnerLabel}. Employer: ${job.company}.`}
        actions={<BackLink href={backHref}>Back to queue</BackLink>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Placement Suitability</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Review the student-submitted opportunity before placement processing begins.
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                [User, 'Student', formatStudentLine(job.studentName, job.studentId)],
                [Building2, 'Employer', job.company],
                [FileText, 'Role', job.jobTitle],
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
            <h2 className="text-lg font-bold text-slate-950">Duties and Description</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {job.description}
            </p>
          </SurfaceCard>

          {attachments.length > 0 && (
            <SurfaceCard className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                <Paperclip className="h-5 w-5 text-red-700" />
                Supporting Evidence
              </h2>
              <AttachmentList
                attachments={attachments}
                error={attachmentError}
                onOpen={onAttachmentOpen}
              />
            </SurfaceCard>
          )}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SurfaceCard className="p-6">
            <CheckerResultPanel
              result={jobCheck.result}
              isLoading={jobCheck.isLoading}
              error={jobCheck.error}
              feature="job-checker"
            />
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Review Decision
            </h2>
            <ReviewDecisionPanel
              id={job.id}
              kind="job"
              defaultNotes={job.notes.join('\n')}
              canReview={canReview}
              reviewedStatus={job.status}
              backHref={backHref}
              onSuccess={onDecisionSuccess}
              onAlreadyReviewed={onAlreadyReviewed}
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

  return <WorkflowStepper className="mt-6" steps={buildWorkflowStepItems(steps, completedCount)} />
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}
