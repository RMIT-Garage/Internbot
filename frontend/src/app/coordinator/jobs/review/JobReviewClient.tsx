'use client'

import Link from 'next/link'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Building2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquareText,
  Paperclip,
  Archive,
  PenLine,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import {
  getOpportunity,
  getOpportunityAttachment,
  getUser,
  listSemesters,
  transitionOpportunity,
  updateOpportunity,
} from '@/lib/coordinator/api'
import {
  mapOpportunityToSelfSourcedJob,
  needsPlacementSuitabilityReview,
  opportunityReviewEyebrow,
  opportunitySourceTypeLabel,
} from '@/lib/coordinator/apiMappers'
import {
  OpportunityEditModal,
  openEditFormForTarget,
} from '@/components/coordinator/OpportunityEditModal'
import {
  canEditManagedOpportunity,
  opportunityResponseToEditTarget,
  type OpportunityEditFormState,
} from '@/components/coordinator/opportunityEdit'
import { type ApprovalStatus, type SelfSourcedJob } from '@/lib/coordinator/mockData'
import { getReviewBackHref } from '@/lib/coordinator/reviewRouting'
import { buildSemesterLabelMap } from '@/lib/semester/display'
import { useJobCheck } from '@/features/coordinator-ai/hooks/useJobCheck'
import { CheckerResultPanel } from '@/features/coordinator-ai/components/CheckerResultPanel'
import type { CheckerInput } from '@/features/coordinator-ai/types'
import { STUDENT_PROFILE_PENDING, formatStudentDisplay } from '@/lib/coordinator/studentDisplay'
import { formatDate } from '@/lib/utils'
import type {
  OpportunityAttachmentResponse,
  OpportunityResponse,
  OpportunityStatus,
  SemesterResponse,
} from '@/types/api'

export function JobReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const backHref = getReviewBackHref(searchParams, '/coordinator/opportunities')
  const [job, setJob] = useState<SelfSourcedJob | null>(null)
  const [opportunityRecord, setOpportunityRecord] = useState<OpportunityResponse | null>(null)
  const [semesterLabels, setSemesterLabels] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [backendStatus, setBackendStatus] = useState<OpportunityStatus | null>(null)
  const [attachments, setAttachments] = useState<OpportunityAttachmentResponse[]>([])
  const [attachmentError, setAttachmentError] = useState<string | null>(null)
  const [studentOwnerLabel, setStudentOwnerLabel] = useState(STUDENT_PROFILE_PENDING)
  const [checkerInput, setCheckerInput] = useState<CheckerInput | null>(null)
  const [semesters, setSemesters] = useState<SemesterResponse[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<OpportunityEditFormState>({
    title: '',
    company: '',
    semesterId: '',
    descriptionText: '',
    sourceUrl: '',
    type: 'custom',
    workMode: 'hybrid',
    location: '',
  })
  const [saving, setSaving] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const jobCheck = useJobCheck(checkerInput)

  useEffect(() => {
    let active = true
    void listSemesters({ limit: 100 })
      .then((result) => {
        if (!active) return
        setSemesters(result.items)
        setSemesterLabels(buildSemesterLabelMap(result.items))
      })
      .catch(() => {
        if (!active) return
        setSemesterLabels({})
      })
    return () => {
      active = false
    }
  }, [])

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
        setOpportunityRecord(opportunity)
        setBackendStatus(opportunity.status)
        const mappedJob = mapOpportunityToSelfSourcedJob(opportunity, semesterLabels)
        const ownerLabel = await resolveStudentOwnerLabel(opportunity.submittedByUserId)
        if (!active) return
        setStudentOwnerLabel(ownerLabel)
        const jobData = { ...mappedJob, studentName: ownerLabel, studentId: ownerLabel }
        setJob(jobData)
        setAttachments(opportunity.attachments)
        if (!needsPlacementSuitabilityReview(opportunity)) {
          if (active) setCheckerInput(null)
          return
        }
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
        } else if (active) {
          setCheckerInput({ userInput })
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
  }, [id, semesterLabels])

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
    setOpportunityRecord(opportunity)
    setBackendStatus(opportunity.status)
    setAttachments(opportunity.attachments)
    setStudentOwnerLabel(ownerLabel)
    setJob((current) => ({
      ...mapOpportunityToSelfSourcedJob(opportunity, semesterLabels),
      studentName: ownerLabel,
      studentId: ownerLabel,
      notes: current?.notes ?? mapOpportunityToSelfSourcedJob(opportunity, semesterLabels).notes,
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

  const isSuitabilityApprovalReview = opportunityRecord
    ? needsPlacementSuitabilityReview(opportunityRecord)
    : false

  const reviewEyebrow = opportunityRecord
    ? opportunityReviewEyebrow(
        opportunityRecord,
        isSuitabilityApprovalReview ? 'suitability' : 'detail'
      )
    : 'Opportunity Review'

  const canSuitabilityReview = backendStatus === 'pending_verification'
  const canEdit =
    opportunityRecord !== null &&
    canEditManagedOpportunity(opportunityResponseToEditTarget(opportunityRecord))
  const canArchive = backendStatus === 'published' || backendStatus === 'draft'

  const handleOpenEdit = () => {
    if (!opportunityRecord) return
    setEditForm(openEditFormForTarget(opportunityResponseToEditTarget(opportunityRecord)))
    setEditOpen(true)
  }

  const handleUpdateOpportunity = async (
    event: FormEvent<HTMLFormElement>,
    opportunityId: string
  ) => {
    event.preventDefault()
    if (!editForm.title.trim() || !editForm.company.trim() || !editForm.semesterId) {
      toast.error('Job title, employer, and semester are required.')
      return
    }
    setSaving(true)
    try {
      const updated = await updateOpportunity(
        { id: opportunityId },
        {
          jobTitle: editForm.title.trim(),
          employerName: editForm.company.trim(),
          semesterId: editForm.semesterId,
          descriptionText: editForm.descriptionText.trim() || undefined,
          workMode: editForm.workMode,
          location: editForm.location.trim() || null,
          sourceUrl: editForm.sourceUrl.trim() || null,
        }
      )
      setOpportunityRecord(updated)
      const ownerLabel = await resolveStudentOwnerLabel(updated.submittedByUserId)
      setStudentOwnerLabel(ownerLabel)
      setJob({
        ...mapOpportunityToSelfSourcedJob(updated, semesterLabels),
        studentName: ownerLabel,
        studentId: ownerLabel,
      })
      setAttachments(updated.attachments)
      setEditOpen(false)
      toast.success('Opportunity updated.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to update opportunity.')
    } finally {
      setSaving(false)
    }
  }

  const handleArchive = async () => {
    if (!opportunityRecord) return
    if (
      !window.confirm(
        'Archive this opportunity? Students will no longer see it on the opportunity board.'
      )
    ) {
      return
    }
    setArchiving(true)
    try {
      const updated = await transitionOpportunity({ id: opportunityRecord.id }, 'archived')
      setOpportunityRecord(updated)
      setBackendStatus(updated.status)
      setJob({
        ...mapOpportunityToSelfSourcedJob(updated, semesterLabels),
        studentName: studentOwnerLabel,
        studentId: studentOwnerLabel,
      })
      setAttachments(updated.attachments)
      toast.success('Opportunity archived.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to archive opportunity.')
    } finally {
      setArchiving(false)
    }
  }

  if (isSuitabilityApprovalReview) {
    return (
      <SuitabilityApprovalReview
        job={job}
        studentOwnerLabel={studentOwnerLabel}
        backHref={backHref}
        eyebrow={reviewEyebrow}
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

  const sourceLabel = opportunityRecord ? opportunitySourceTypeLabel(opportunityRecord) : ''
  const listingDescription =
    opportunityRecord?.type === 'pre_approved'
      ? `CareerHub listing for ${job.company}.`
      : opportunityRecord?.status === 'published'
        ? `Published listing for ${job.company} — edit details or archive when the role is no longer active.`
        : `Coordinator listing for ${job.company}.`

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow={reviewEyebrow}
        title={job.jobTitle}
        description={listingDescription}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={handleOpenEdit}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                <PenLine className="h-4 w-4" />
                Edit opportunity
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={() => void handleArchive()}
                disabled={archiving}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Archive className="h-4 w-4" />
                {archiving ? 'Archiving…' : 'Archive'}
              </button>
            )}
            <BackLink href={backHref}>Back to opportunities</BackLink>
          </div>
        }
      />

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
              {sourceLabel}
            </span>
            <h2 className="mt-3 text-xl font-bold text-slate-950">{job.jobTitle}</h2>
            <p className="mt-1 text-sm text-slate-600">{job.company}</p>
          </div>
          {backendStatus && <PublishedStatusPill status={backendStatus} />}
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [Clock3, 'Semester', job.semester],
            [MapPin, 'Location', opportunityRecord?.location ?? 'Not supplied'],
            [Clock3, 'Work mode', job.workPattern],
            [FileText, 'Applications', String(opportunityRecord?.applicationCount ?? 0)],
            [Clock3, 'Last updated', formatDate(job.submissionDate)],
          ].map(([Icon, label, value]) => {
            const DetailIcon = Icon as typeof User
            return (
              <div
                key={label as string}
                className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4"
              >
                <DetailIcon className="h-4 w-4 text-red-700" />
                <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                  {label as string}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-950">{value as string}</p>
              </div>
            )
          })}
        </div>
        {opportunityRecord?.sourceUrl && (
          <a
            href={opportunityRecord.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-red-700 hover:text-red-900"
          >
            <ExternalLink className="h-4 w-4" />
            Open listing URL
          </a>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <h2 className="text-lg font-bold text-slate-950">Role description</h2>
        <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          {job.description}
        </p>
      </SurfaceCard>

      {attachments.length > 0 && (
        <SurfaceCard className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Paperclip className="h-5 w-5 text-red-700" />
            Attachments
          </h2>
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
      )}

      {opportunityRecord && (
        <OpportunityEditModal
          open={editOpen}
          target={opportunityResponseToEditTarget(opportunityRecord)}
          form={editForm}
          semesters={semesters}
          saving={saving}
          onFormChange={setEditForm}
          onClose={() => setEditOpen(false)}
          onSubmit={handleUpdateOpportunity}
        />
      )}
    </div>
  )
}

function PublishedStatusPill({ status }: { status: OpportunityStatus }) {
  const label =
    status === 'published'
      ? 'Published'
      : status === 'draft'
        ? 'Draft'
        : status === 'archived'
          ? 'Archived'
          : status.replace(/_/g, ' ')
  return (
    <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 capitalize">
      {label}
    </span>
  )
}

function SuitabilityApprovalReview({
  job,
  studentOwnerLabel,
  backHref,
  eyebrow,
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
  eyebrow: string
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
        eyebrow={eyebrow}
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

function decisionToJobBackendStatus(decision: ReviewDecision): OpportunityStatus {
  return decision === 'approved' ? 'published' : 'rejected'
}

function decisionToStatus(decision: ReviewDecision): ApprovalStatus {
  if (decision === 'approved') return 'awaiting_contract_details'
  if (decision === 'rejected') return 'rejected'
  return 'changes_requested'
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
