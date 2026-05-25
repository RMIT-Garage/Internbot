'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Download, ExternalLink, FileText, MessageSquareText, Paperclip } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import { WorkflowStepper, buildWorkflowStepItems } from '@/components/coordinator/WorkflowStepper'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getInternship, getInternshipAttachment, getUser } from '@/lib/coordinator/api'
import { mapInternshipToContractApproval } from '@/lib/coordinator/apiMappers'
import { type ApprovalStatus, type ContractApproval } from '@/lib/coordinator/mockData'
import { getReviewBackHref } from '@/lib/coordinator/reviewRouting'
import { useContractCheck } from '@/features/coordinator-ai/hooks/useContractCheck'
import { CheckerResultPanel } from '@/features/coordinator-ai/components/CheckerResultPanel'
import type { CheckerInput } from '@/features/coordinator-ai/types'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'
import type { InternshipAttachmentResponse, InternshipStatus } from '@/types/api'

export function ContractReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const backHref = getReviewBackHref(searchParams, '/coordinator/jobs')
  const [contract, setContract] = useState<ContractApproval | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<InternshipStatus | null>(null)
  const [attachments, setAttachments] = useState<InternshipAttachmentResponse[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [studentLabel, setStudentLabel] = useState(STUDENT_PROFILE_PENDING)
  const [checkerInput, setCheckerInput] = useState<CheckerInput | null>(null)
  const contractCheck = useContractCheck(checkerInput)

  useEffect(() => {
    let active = true

    if (!id) return

    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setError(null)
    })
    getInternship(id)
      .then(async (internship) => {
        if (!active) return
        const resolvedStudentLabel = await resolveStudentLabel(internship.userId)
        if (!active) return
        setBackendStatus(internship.status)
        const mapped = mapInternshipToContractApproval(internship)
        setContract(mapped)
        setAttachments(internship.attachments)
        setStudentLabel(resolvedStudentLabel)
        const userInput = `Student: ${resolvedStudentLabel}\nCourse: ${mapped.course}\nSemester: ${mapped.semester}\nPlacement Host: ${mapped.placementHost}\nDocument: ${mapped.documentName}`
        const primaryAttachment = internship.attachments[0]
        if (primaryAttachment) {
          try {
            const { downloadUrl } = await getInternshipAttachment(id, primaryAttachment.id)
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
        setContract(null)
        setError(
          err instanceof Error
            ? `Unable to load this contract review: ${err.message}`
            : 'Unable to load this contract review.'
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
        title="Contract review unavailable"
        message="No contract was selected. Return to the queue and open a row from View Details."
        backHref={backHref}
      />
    )
  }

  if (loading) {
    return <CoordinatorContentSkeleton title="Loading contract review…" />
  }

  if (!contract) {
    return (
      <ReviewNotice
        title="Contract review unavailable"
        message={error ?? 'The selected contract review was not found.'}
        backHref={backHref}
      />
    )
  }

  const refreshContract = async () => {
    const internship = await getInternship(contract.id)
    const mapped = mapInternshipToContractApproval(internship)
    const resolvedStudentLabel = await resolveStudentLabel(internship.userId)
    setBackendStatus(internship.status)
    setAttachments(internship.attachments)
    setStudentLabel(resolvedStudentLabel)
    setContract((current) => ({
      ...mapped,
      notes: current?.notes ?? mapped.notes,
    }))
  }

  const handleDecisionSuccess = (decision: ReviewDecision, notes: string) => {
    setContract((current) =>
      current
        ? {
            ...current,
            status: decisionToStatus(decision),
            notes: notes ? [notes, ...current.notes] : current.notes,
          }
        : current
    )
    setBackendStatus(decisionToContractBackendStatus(decision))
  }
  const studentDisplay =
    studentLabel !== STUDENT_PROFILE_PENDING
      ? studentLabel
      : formatStudentDisplay({
          studentId: contract.studentId,
          name: contract.studentName,
        })

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Contract Review"
        title={contract.documentName}
        description={`${studentDisplay} placement agreement with ${contract.placementHost}.`}
        actions={<BackLink href={backHref}>Back to queue</BackLink>}
      />

      <CaseHeader
        title={contract.documentName}
        student={studentDisplay}
        studentId={studentDisplay}
        employer={contract.placementHost}
        status={contract.status}
        submittedAt={contract.submissionDate}
        canReview={backendStatus === 'offer_pending_review'}
        reviewer="Coordinator queue"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Contract Information</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Placement confirmed {formatDate(contract.submissionDate)}
                </p>
              </div>
              <StatusBadge status={contract.status} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                ['Student', studentDisplay],
                ['Course', contract.course],
                ['Semester', contract.semester],
                ['Placement host', contract.placementHost],
                ['Document', contract.documentName],
                ['Placement confirmed', formatDate(contract.submissionDate)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
                  <FileText className="h-4 w-4 text-red-700" />
                  <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <Paperclip className="h-5 w-5 text-red-700" />
              Documents and Attachments
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Uploaded placement contracts, offer evidence, and supporting documents.
            </p>
            <AttachmentList
              attachments={attachments}
              error={attachmentError}
              onOpen={async (attachment, mode) => {
                setAttachmentError(null)
                try {
                  const download = await getInternshipAttachment(contract.id, attachment.id)
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
              result={contractCheck.result}
              isLoading={contractCheck.isLoading}
              error={contractCheck.error}
              feature="contract-checker"
            />
          </SurfaceCard>
          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Review Decision
            </h2>
            <ReviewDecisionPanel
              id={contract.id}
              kind="contract"
              defaultNotes={contract.notes.join('\n')}
              canReview={backendStatus === 'offer_pending_review'}
              reviewedStatus={contract.status}
              backHref={backHref}
              onSuccess={handleDecisionSuccess}
              onAlreadyReviewed={refreshContract}
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
  attachments: InternshipAttachmentResponse[]
  error: string | null
  onOpen: (attachment: InternshipAttachmentResponse, mode: 'view' | 'download') => Promise<void>
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

async function resolveStudentLabel(userId: string | null | undefined) {
  if (!userId) return STUDENT_PROFILE_PENDING
  try {
    return formatStudentDisplay(await getUser(userId))
  } catch {
    return STUDENT_PROFILE_PENDING
  }
}

function formatStudentLine(student: string, studentId: string) {
  if (!studentId || studentId === student) return student
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
  const currentIndex = steps.findIndex((step) => step.current)
  const completedBeforeCurrent = status === 'approved' ? steps.length : Math.max(0, currentIndex)

  return (
    <WorkflowStepper
      className="mt-6"
      steps={buildWorkflowStepItems(steps, completedBeforeCurrent)}
    />
  )
}

function getWorkflowSteps(status: ApprovalStatus) {
  const terminal = status === 'rejected' ? 'rejected' : 'approved'
  let current: 'submitted' | 'documents' | 'review' | 'verification' | 'approved' | 'rejected' =
    'verification'
  if (status === 'changes_requested' || status === 'awaiting_documents') current = 'documents'
  if (status === 'awaiting_review' || status === 'awaiting_contract_review')
    current = 'verification'
  if (status === 'awaiting_approval' || status === 'flagged') current = 'review'
  if (status === 'approved') current = 'approved'
  if (status === 'rejected') current = 'rejected'
  const currentStep = current as string

  return [
    { id: 'submitted', label: 'Placement Confirmed', current: currentStep === 'submitted' },
    { id: 'documents', label: 'Documents Submitted', current: currentStep === 'documents' },
    { id: 'verification', label: 'Contract Review', current: currentStep === 'verification' },
    { id: 'review', label: 'Final Approval', current: currentStep === 'review' },
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

function decisionToContractBackendStatus(decision: ReviewDecision): InternshipStatus {
  if (decision === 'approved') return 'offer_approved'
  if (decision === 'rejected') return 'rejected'
  return 'offer_changes_requested'
}

function decisionToStatus(decision: ReviewDecision): ApprovalStatus {
  if (decision === 'approved') return 'approved'
  if (decision === 'rejected') return 'rejected'
  return 'changes_requested'
}

function ReviewNotice({
  title,
  message,
  backHref = '/coordinator/jobs',
}: {
  title: string
  message: string
  backHref?: string
}) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Contract Review"
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
