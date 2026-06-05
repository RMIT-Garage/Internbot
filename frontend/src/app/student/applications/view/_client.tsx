'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  CalendarDays,
  FileText,
  MapPin,
  Monitor,
  Paperclip,
  Pencil,
  UploadCloud,
  X,
} from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { InternshipsService, OpportunitiesService } from '@/lib/api/openapi-client'
import type {
  InternshipResponse,
  OpportunityResponse,
  CreateInternshipAttachmentUploadIntentRequest,
} from '@/lib/api/openapi-client'
import type { PatchInternshipRequest } from '@/api'
import { apiFetch } from '@/lib/api/client'
import { formatDate } from '@/lib/utils'
import { CheckerResultPanel } from '@/features/coordinator-ai/components/CheckerResultPanel'
import { useStudentContractCheck } from '@/features/coordinator-ai/hooks/useStudentContractCheck'
import type { CheckerInput } from '@/features/coordinator-ai/types'

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
}
const MAX_BYTES = 25 * 1024 * 1024

type StageStatus = 'completed' | 'active' | 'pending' | 'changes_requested' | 'rejected'

interface Stage {
  label: string
  status: StageStatus
}

/** AI contract check only after the student has submitted offer documents to the coordinator. */
function shouldShowContractAssessment(
  internship: Pick<InternshipResponse, 'status' | 'lastSubmittedAt'>
): boolean {
  if (internship.lastSubmittedAt) return true
  return internship.status !== 'applied'
}

function getStages(status: InternshipResponse['status']): Stage[] {
  const isRejected = status === 'rejected'
  const isWithdrawn = status === 'withdrawn'
  const isTerminal = isRejected || isWithdrawn
  const pastApplied = status !== 'applied'
  const pastSubmit = status === 'offer_pending_review' || status === 'offer_approved' || isTerminal
  const isReviewing = status === 'offer_pending_review'
  const isApproved = status === 'offer_approved'
  const isChanges = status === 'offer_changes_requested'

  return [
    { label: 'Applied', status: isWithdrawn ? 'rejected' : 'completed' },
    {
      label: 'Offer Submitted',
      status: isChanges
        ? 'changes_requested'
        : isTerminal
          ? 'rejected'
          : pastSubmit
            ? 'completed'
            : pastApplied
              ? 'active'
              : 'pending',
    },
    {
      label: 'Under Review',
      status: isTerminal
        ? 'rejected'
        : isApproved
          ? 'completed'
          : isReviewing
            ? 'active'
            : 'pending',
    },
    {
      label: 'Confirmed',
      status: isApproved ? 'completed' : isTerminal ? 'rejected' : 'pending',
    },
  ]
}

function StageBar({ status }: { status: InternshipResponse['status'] }) {
  const stages = getStages(status)
  const lastCompletedIdx = stages.reduce(
    (acc, s, i) => (s.status === 'completed' || s.status === 'active' ? i : acc),
    -1
  )
  const progressPct =
    lastCompletedIdx < 0
      ? 0
      : lastCompletedIdx === stages.length - 1
        ? 100
        : (lastCompletedIdx / (stages.length - 1)) * 100

  return (
    <SurfaceCard className="px-8 py-6">
      <div className="relative">
        {/* Track */}
        <div className="absolute top-4 right-[12.5%] left-[12.5%] h-0.5 bg-gray-200" />
        {/* Progress fill */}
        <div
          className="absolute top-4 left-[12.5%] h-0.5 bg-red-600 transition-all duration-500"
          style={{ width: `calc(${progressPct}% * 0.75)` }}
        />
        {/* Dots + labels */}
        <div className="relative grid grid-cols-4">
          {stages.map((stage) => {
            const dotClass =
              stage.status === 'completed'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                : stage.status === 'active'
                  ? 'bg-white text-red-600 ring-2 ring-red-500 shadow-sm shadow-red-100'
                  : stage.status === 'changes_requested'
                    ? 'bg-amber-50 text-amber-600 ring-2 ring-amber-400'
                    : stage.status === 'rejected'
                      ? 'bg-red-900 text-white'
                      : 'bg-white text-gray-300 ring-1 ring-gray-200'
            const labelClass =
              stage.status === 'active'
                ? 'text-red-600 font-semibold'
                : stage.status === 'completed'
                  ? 'text-gray-700 font-medium'
                  : stage.status === 'changes_requested'
                    ? 'text-amber-700 font-semibold'
                    : stage.status === 'rejected'
                      ? 'text-red-900 font-semibold'
                      : 'text-gray-400'

            return (
              <div key={stage.label} className="flex flex-col items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dotClass}`}
                >
                  {stage.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : stage.status === 'active' ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : stage.status === 'changes_requested' ? (
                    <span>!</span>
                  ) : stage.status === 'rejected' ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <p className={`text-center text-xs leading-tight ${labelClass}`}>{stage.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </SurfaceCard>
  )
}

function ReviewerPanel({ internship }: { internship: InternshipResponse }) {
  const { coordinatorDecision, coordinatorComment, reviewedAt } = internship

  const decisionConfig: Record<
    NonNullable<InternshipResponse['coordinatorDecision']>,
    { label: string; dot: string; bg: string; text: string; border: string }
  > = {
    approved: {
      label: 'Approved',
      dot: 'bg-green-500',
      bg: 'bg-green-50',
      text: 'text-green-800',
      border: 'border-green-200',
    },
    rejected: {
      label: 'Rejected',
      dot: 'bg-red-500',
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
    },
    changes_requested: {
      label: 'Changes Requested',
      dot: 'bg-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
    },
  }

  const cfg = coordinatorDecision ? decisionConfig[coordinatorDecision] : null

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-red-600 uppercase">
          Coordinator Review
        </p>
        <h2 className="mt-0.5 text-sm font-bold text-black">Reviewer Notes & Decision</h2>
      </div>

      <div className="px-5 py-4">
        {!coordinatorDecision ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <Clock className="h-5 w-5 text-gray-400" />
            </div>
            <p className="mt-3 text-sm font-semibold text-gray-600">Awaiting review</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-400">
              Your coordinator will review your submitted offer documents.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-xl border px-4 py-3.5 ${cfg!.bg} ${cfg!.border}`}>
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${cfg!.dot}`} />
                <p className={`text-sm font-bold ${cfg!.text}`}>{cfg!.label}</p>
              </div>
              {reviewedAt && (
                <p className="mt-1.5 text-xs text-gray-500">Reviewed {formatDate(reviewedAt)}</p>
              )}
            </div>
            {coordinatorComment && (
              <div>
                <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                  Notes
                </p>
                <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                  {coordinatorComment}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </SurfaceCard>
  )
}

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  pre_approved: 'Pre-approved',
  custom: 'Self-sourced',
}

function JobDetailsCard({
  internship,
  opportunity,
}: {
  internship: InternshipResponse
  opportunity: OpportunityResponse | null
}) {
  const [expanded, setExpanded] = useState(false)
  const hasDescription = !!opportunity?.descriptionText

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 text-left transition hover:bg-gray-50"
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] text-red-600 uppercase">
            Opportunity
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-black">{internship.opportunityJobTitle}</h2>
          <p className="mt-0.5 text-xs text-gray-500">{internship.opportunityEmployerName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-semibold text-gray-400">
            {expanded ? 'Hide details' : 'View details'}
          </span>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="space-y-4 px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              {internship.opportunityEmployerName}
            </div>
            {opportunity?.workMode && (
              <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 capitalize">
                <Monitor className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.workMode}
              </div>
            )}
            {opportunity?.location && (
              <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.location}
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <FileText className="h-3.5 w-3.5 text-gray-400" />
              {OPPORTUNITY_TYPE_LABELS[internship.opportunityType] ?? internship.opportunityType}
            </div>
            <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
              {internship.semesterDisplayName}
              {internship.semesterCode ? ` · ${internship.semesterCode}` : ''}
            </div>
          </div>

          {hasDescription && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-600">
              {opportunity!.descriptionText}
            </p>
          )}

          {internship.opportunitySourceUrl && (
            <p className="text-xs text-gray-400">
              Source:{' '}
              <a
                href={internship.opportunitySourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-gray-600"
              >
                {internship.opportunitySourceUrl}
              </a>
            </p>
          )}
        </div>
      )}
    </SurfaceCard>
  )
}

export default function ApplicationDetailClient() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [internship, setInternship] = useState<InternshipResponse | null>(null)
  const [opportunity, setOpportunity] = useState<OpportunityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Guards background polls so they don't set state after unmount.
  const mountedRef = useRef(true)

  // Offer submission state (for initial submit — applied / offer_changes_requested)
  const [offerDate, setOfferDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Offer edit state (for patching dates while offer_pending_review)
  const [editingDates, setEditingDates] = useState(false)
  const [editOfferDate, setEditOfferDate] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [withdrawConfirming, setWithdrawConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState<string | null>(null)

  const [checkerInput, setCheckerInput] = useState<CheckerInput | null>(null)
  const showContractAssessment = internship !== null && shouldShowContractAssessment(internship)
  const contractCheck = useStudentContractCheck(showContractAssessment ? checkerInput : null)

  useEffect(() => {
    if (authLoading || !user || !id) return
    let active = true
    const run = async () => {
      try {
        setLoading(true)
        const data = await InternshipsService.getInternship(id)
        if (!active) return

        // Delete any attachments stuck in uploading state from previous sessions
        const stuck = data.attachments.filter((a) => a.uploadStatus !== 'finalized')
        if (stuck.length > 0) {
          await Promise.allSettled(
            stuck.map((a) => InternshipsService.deleteInternshipAttachment(id, a.id))
          )
          const cleaned = await InternshipsService.getInternship(id)
          if (active) setInternship(cleaned)
        } else {
          if (active) setInternship(data)
        }

        // Fetch opportunity details in parallel (non-fatal if it fails)
        OpportunitiesService.getOpportunity(data.opportunityId)
          .then((opp) => {
            if (active) setOpportunity(opp)
          })
          .catch(() => {
            /* non-fatal — basic details still available on internship */
          })

        if (shouldShowContractAssessment(data)) {
          const contractText = [
            `Employer: ${data.opportunityEmployerName}`,
            `Job Title: ${data.opportunityJobTitle}`,
            `Program Code: ${data.studentProgramCode ?? 'unknown'}`,
            `Offer Date: ${data.offerDate ?? 'unknown'}`,
            `Start Date: ${data.startDate ?? 'unknown'}`,
            `End Date: ${data.endDate ?? 'unknown'}`,
          ].join('\n')

          const primaryAtt = data.attachments.find((a) => a.uploadStatus === 'finalized')
          if (primaryAtt && active) {
            InternshipsService.getInternshipAttachment(id, primaryAtt.id)
              .then(async ({ downloadUrl }) => {
                const res = await fetch(downloadUrl)
                if (!res.ok) throw new Error('download failed')
                const buf = await res.arrayBuffer()
                if (active)
                  setCheckerInput({
                    userInput: contractText,
                    attachment: {
                      mimeType: primaryAtt.contentType ?? 'application/octet-stream',
                      dataBase64: arrayBufferToBase64(buf),
                      fileName: primaryAtt.fileName ?? undefined,
                    },
                  })
              })
              .catch(() => {
                if (active) setCheckerInput({ userInput: contractText })
              })
          } else if (active) {
            setCheckerInput({ userInput: contractText })
          }
        } else if (active) {
          setCheckerInput(null)
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load application')
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => {
      active = false
    }
  }, [authLoading, user, id, retryCount])

  // Pre-populate submit form from existing internship dates (relevant for offer_changes_requested)
  useEffect(() => {
    if (!internship) return
    if (offerDate === '' && internship.offerDate) setOfferDate(toDateInput(internship.offerDate))
    if (startDate === '' && internship.startDate) setStartDate(toDateInput(internship.startDate))
    if (endDate === '' && internship.endDate) setEndDate(toDateInput(internship.endDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [internship?.id])

  // Keep polling while any attachment is still confirming so the submit button unlocks automatically
  useEffect(() => {
    if (!user || !id || uploading) return
    const hasUnfinalized = internship?.attachments.some((a) => a.uploadStatus !== 'finalized')
    if (!hasUnfinalized) return
    let active = true
    const timer = setTimeout(async () => {
      try {
        const updated = await InternshipsService.getInternship(id)
        if (active) setInternship(updated)
      } catch {
        // silently ignore — the initial load error is already shown
      }
    }, 2000)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [user, id, internship, uploading])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!id) return
    setDeletingAttachmentId(attachmentId)
    try {
      await InternshipsService.deleteInternshipAttachment(id, attachmentId)
      setInternship((prev) =>
        prev
          ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) }
          : prev
      )
    } catch {
      setUploadError('Failed to delete the document. Please try again.')
    } finally {
      setDeletingAttachmentId(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)
    if (!ACCEPTED_TYPES[file.type]) {
      setUploadError('Unsupported file type. Please upload a PDF, DOC/DOCX, PNG, or JPEG.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File exceeds the 25 MB limit.')
      return
    }
    setSelectedFile(file)
  }

  // Polls in the background until OBJECT_FINALIZE flips the attachment to
  // finalized. Uses a 120s window because Eventarc cold-starts on dev can
  // take well beyond 30s. If it times out, deletes the stuck row so the user
  // can try again, and surfaces an error. Stops immediately on unmount.
  const pollAttachmentFinalized = async (attachmentId: string) => {
    const deadline = Date.now() + 120_000
    while (mountedRef.current && id && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000))
      if (!mountedRef.current || !id) return
      let updated: InternshipResponse
      try {
        updated = await InternshipsService.getInternship(id)
      } catch {
        continue
      }
      if (!mountedRef.current) return
      setInternship(updated)
      const att = updated.attachments.find((a) => a.id === attachmentId)
      if (att?.uploadStatus === 'finalized') return
    }
    // Timed out — clean up the stuck row so the user isn't permanently blocked.
    if (!mountedRef.current || !id) return
    try {
      await InternshipsService.deleteInternshipAttachment(id, attachmentId)
      if (!mountedRef.current) return
      setInternship((prev) =>
        prev
          ? { ...prev, attachments: prev.attachments.filter((a) => a.id !== attachmentId) }
          : prev
      )
    } catch {
      // ignore — worst case the stuck row remains until next page load (which auto-cleans it)
    }
    setUploadError(
      'Upload confirmation is taking too long. The file was received but could not be confirmed — please try uploading again.'
    )
  }

  const handleUpload = async () => {
    if (!selectedFile || !id) return
    setUploadError(null)
    try {
      setUploading(true)

      const file = selectedFile
      const intent = await InternshipsService.createInternshipAttachmentUploadIntent(id, {
        fileName: file.name,
        contentType: file.type as CreateInternshipAttachmentUploadIntentRequest.contentType,
      })

      // Real GCS V4 signed URLs use PUT; the local Storage emulator returns a
      // multipart POST URL instead (it doesn't support signed-URL PUT).
      const uploadMethod = intent.uploadUrl.startsWith('http://') ? 'POST' : 'PUT'
      const putRes = await fetch(intent.uploadUrl, {
        method: uploadMethod,
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

      // Directly finalize via API — no need to wait for the Eventarc
      // OBJECT_FINALIZE cold start (can be minutes on dev). The trigger
      // still fires later and is a no-op on an already-finalized attachment.
      try {
        const confirmed = await apiFetch<InternshipResponse>(
          `/api/v1/internships/${id}/attachments/${intent.attachmentId}/confirm`,
          { method: 'POST' }
        )
        setInternship(confirmed)
      } catch {
        // Confirm endpoint unavailable (e.g. older backend) — fall back to
        // a one-time refresh so the "uploading" row appears and let the
        // background poll flip it to "finalized" when Eventarc delivers.
        const refreshed = await InternshipsService.getInternship(id)
        setInternship(refreshed)
        void pollAttachmentFinalized(intent.attachmentId)
      }

      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setUploadError(
        msg === 'Failed to fetch'
          ? 'Could not reach the server. Check your connection and try again.'
          : msg || 'Upload failed. Please try again.'
      )
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleSubmitToCoordinator = async () => {
    if (!id) return
    setSubmitError(null)
    try {
      setSubmitting(true)
      const updated = await InternshipsService.submitInternshipOffer(id, {
        ...(offerDate && { offerDate: toIso(offerDate) }),
        ...(startDate && { startDate: toIso(startDate) }),
        ...(endDate && { endDate: toIso(endDate) }),
      })
      setInternship(updated)
    } catch (err: unknown) {
      const anyErr = err as { body?: { error?: { message?: string } }; message?: string }
      setSubmitError(
        anyErr.body?.error?.message ?? anyErr.message ?? 'Failed to submit. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleWithdraw = async () => {
    if (!id) return
    setWithdrawError(null)
    setWithdrawing(true)
    try {
      const updated = await InternshipsService.withdrawInternship(id)
      setInternship(updated)
      setWithdrawConfirming(false)
    } catch (err: unknown) {
      const anyErr = err as { body?: { error?: { message?: string } }; message?: string }
      setWithdrawError(
        anyErr.body?.error?.message ?? anyErr.message ?? 'Failed to withdraw. Please try again.'
      )
    } finally {
      setWithdrawing(false)
    }
  }

  const toIso = (d: string) => new Date(d).toISOString()
  const toDateInput = (iso: string | undefined | null) =>
    iso ? new Date(iso).toISOString().slice(0, 10) : ''

  const handleSaveDates = async () => {
    if (!id || !editOfferDate || !editStartDate) return
    setSaveError(null)
    try {
      setSaving(true)
      const patch: PatchInternshipRequest = {
        offerDate: toIso(editOfferDate),
        startDate: toIso(editStartDate),
        endDate: editEndDate ? toIso(editEndDate) : null,
      }
      const updated = await InternshipsService.patchInternship(id, patch)
      setInternship(updated)
      setEditingDates(false)
    } catch (err: unknown) {
      const anyErr = err as { body?: { error?: { message?: string } }; message?: string }
      setSaveError(
        anyErr.body?.error?.message ?? anyErr.message ?? 'Failed to save. Please try again.'
      )
    } finally {
      setSaving(false)
    }
  }

  const hasFinalized = internship?.attachments.some((a) => a.uploadStatus === 'finalized') ?? false
  const hasProcessing = internship?.attachments.some((a) => a.uploadStatus !== 'finalized') ?? false

  const canAct =
    internship !== null && ['applied', 'offer_changes_requested'].includes(internship.status)
  // upload zone visible when canAct, OR when in offer_pending_review and edit mode is open
  const canUpload = canAct || (internship?.status === 'offer_pending_review' && editingDates)
  const canEditUnderReview = internship?.status === 'offer_pending_review'

  const canSubmitToCoordinator = canAct && hasFinalized

  if (!id) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        No application ID provided.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="My Application"
        title={loading ? 'Loading...' : (internship?.opportunityJobTitle ?? 'Not found')}
        description={
          loading ? 'Fetching application details...' : (internship?.opportunityEmployerName ?? '')
        }
        actions={
          <Link
            href="/student/applications"
            className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-black hover:bg-black/5"
          >
            Back to applications
          </Link>
        }
      />

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              setError(null)
              setRetryCount((c) => c + 1)
            }}
            className="shrink-0 font-semibold underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-6">
            <SurfaceCard className="p-6">
              <Skeleton className="h-6 w-40" />
              <div className="mt-6 space-y-3">
                <Skeleton className="h-14 rounded-2xl" />
                <Skeleton className="h-14 rounded-2xl" />
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-6">
              <Skeleton className="h-6 w-32" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
              </div>
              <Skeleton className="mt-4 h-10 rounded-2xl" />
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-5 w-40" />
            <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 rounded-xl" />
              ))}
            </div>
          </SurfaceCard>
        </div>
      )}

      {!loading && internship && <StageBar status={internship.status} />}

      {!loading && internship && (
        <JobDetailsCard internship={internship} opportunity={opportunity} />
      )}

      {!loading && internship && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left column */}
          <div className="space-y-5">
            {/* Changes requested banner */}
            {internship.status === 'offer_changes_requested' && internship.coordinatorComment && (
              <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Changes requested</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-amber-700">
                    {internship.coordinatorComment}
                  </p>
                </div>
              </div>
            )}

            {/* Offer Documents */}
            <SurfaceCard className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-4">
                <div>
                  <h2 className="text-base font-bold text-black">Offer Documents</h2>
                  {internship.lastSubmittedAt ? (
                    <p className="mt-0.5 text-xs text-gray-500">
                      Last submitted {formatDate(internship.lastSubmittedAt)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Upload your signed offer letter and any supporting documents.
                    </p>
                  )}
                </div>
                <StatusBadge status={internship.status as StudentStatus} />
              </div>

              <div className="px-6 py-4">
                {internship.attachments.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                      <FileText className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="mt-3 text-sm font-medium text-gray-500">No documents yet</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Upload your offer letter to get started.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {internship.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                          <Paperclip className="h-3.5 w-3.5 text-gray-400" />
                        </div>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">
                          {att.fileName ?? att.id}
                        </span>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            att.uploadStatus === 'finalized'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {att.uploadStatus === 'finalized' ? 'Uploaded' : 'Confirming…'}
                        </span>
                        {canAct && (
                          <button
                            type="button"
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={deletingAttachmentId === att.id}
                            aria-label={`Remove ${att.fileName ?? att.id}`}
                            className="shrink-0 rounded-lg p-1 text-gray-300 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload section */}
                {canUpload && (
                  <div className="mt-4 space-y-3">
                    {uploadError && (
                      <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                        <p className="text-xs text-red-700">{uploadError}</p>
                      </div>
                    )}

                    {hasProcessing && !uploading && (
                      <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                        <p className="text-xs text-amber-700">
                          Waiting for previous upload to confirm…
                        </p>
                      </div>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                      aria-label="Select offer document"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={uploading || hasProcessing}
                    />

                    {selectedFile ? (
                      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                        <Paperclip className="h-4 w-4 shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">
                          {selectedFile.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFile(null)
                            setUploadError(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          className="shrink-0 rounded-lg p-1 text-gray-300 hover:bg-gray-200 hover:text-gray-500"
                          aria-label="Remove selected file"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || hasProcessing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white py-4 text-sm font-medium text-gray-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      >
                        <UploadCloud className="h-4 w-4" />
                        Choose a document to upload
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading || hasProcessing}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:opacity-40"
                    >
                      <UploadCloud className="h-4 w-4" />
                      {uploading ? 'Uploading…' : 'Upload document'}
                    </button>

                    <p className="text-center text-xs text-gray-400">
                      PDF, DOC/DOCX, PNG or JPEG · max 25 MB
                    </p>
                  </div>
                )}
              </div>
            </SurfaceCard>

            {/* Offer Details + Submit (applied / offer_changes_requested) */}
            {canAct && (
              <SurfaceCard className="overflow-hidden p-0">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="text-base font-bold text-black">
                    {internship.status === 'offer_changes_requested'
                      ? 'Resubmit Offer'
                      : 'Offer Details'}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {internship.status === 'offer_changes_requested'
                      ? 'Upload the requested documents and resubmit to your coordinator.'
                      : 'Optionally add your placement dates before submitting.'}
                  </p>
                </div>

                <div className="px-6 py-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-600" htmlFor="offerDate">
                        Offer date <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="offerDate"
                        type="date"
                        value={offerDate}
                        onChange={(e) => setOfferDate(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-600" htmlFor="startDate">
                        Start date <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="startDate"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-600" htmlFor="endDate">
                        End date <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                      />
                    </div>
                  </div>

                  {!hasFinalized && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
                      <AlertTriangle className="h-3 w-3 shrink-0 text-amber-400" />
                      Upload at least one document to enable submission.
                    </p>
                  )}

                  {submitError && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                      <p className="text-xs text-red-700">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSubmitToCoordinator}
                    disabled={!canSubmitToCoordinator || submitting}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
                  >
                    {submitting
                      ? 'Submitting…'
                      : internship.status === 'offer_changes_requested'
                        ? 'Resubmit to Coordinator'
                        : 'Submit to Coordinator'}
                  </button>
                </div>
              </SurfaceCard>
            )}

            {canEditUnderReview && (
              <>
                {/* Submission Details — read-only summary */}
                <SurfaceCard className="overflow-hidden p-0">
                  <div className="border-b border-gray-100 px-6 py-4">
                    <h2 className="text-base font-bold text-black">Submission Details</h2>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Your submission is under review. You can add documents or update dates — the
                      coordinator will see the latest version.
                    </p>
                  </div>
                  <div className="px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        { label: 'Offer date', value: internship.offerDate },
                        { label: 'Start date', value: internship.startDate },
                        { label: 'End date', value: internship.endDate },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p className="text-xs font-semibold text-gray-400">{label}</p>
                          <p className="mt-1 text-sm font-medium text-gray-800">
                            {value ? formatDate(value) : <span className="text-gray-400">—</span>}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </SurfaceCard>

                {/* Edit submission — button or expanded form below the card */}
                {!editingDates ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditOfferDate(toDateInput(internship.offerDate))
                      setEditStartDate(toDateInput(internship.startDate))
                      setEditEndDate(toDateInput(internship.endDate))
                      setSaveError(null)
                      setEditingDates(true)
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit submission
                  </button>
                ) : (
                  <SurfaceCard className="overflow-hidden p-0">
                    <div className="border-b border-gray-100 px-6 py-4">
                      <h2 className="text-base font-bold text-black">Edit Submission</h2>
                      <p className="mt-0.5 text-xs text-gray-500">
                        Update your dates or add more documents. The coordinator will see the latest
                        version.
                      </p>
                    </div>
                    <div className="space-y-4 px-6 py-5">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-xs font-semibold text-gray-600"
                            htmlFor="editOfferDate"
                          >
                            Offer date <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="editOfferDate"
                            type="date"
                            value={editOfferDate}
                            onChange={(e) => setEditOfferDate(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-xs font-semibold text-gray-600"
                            htmlFor="editStartDate"
                          >
                            Start date <span className="text-red-600">*</span>
                          </label>
                          <input
                            id="editStartDate"
                            type="date"
                            value={editStartDate}
                            onChange={(e) => setEditStartDate(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label
                            className="text-xs font-semibold text-gray-600"
                            htmlFor="editEndDate"
                          >
                            End date <span className="font-normal text-gray-400">(optional)</span>
                          </label>
                          <input
                            id="editEndDate"
                            type="date"
                            value={editEndDate}
                            onChange={(e) => setEditEndDate(e.target.value)}
                            className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-black focus:border-red-400 focus:ring-2 focus:ring-red-100 focus:outline-none"
                          />
                        </div>
                      </div>

                      {saveError && (
                        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          <p className="text-xs text-red-700">{saveError}</p>
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDates(false)
                            setSelectedFile(null)
                            setUploadError(null)
                            if (fileInputRef.current) fileInputRef.current.value = ''
                          }}
                          disabled={saving}
                          className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveDates}
                          disabled={!editOfferDate || !editStartDate || saving}
                          className="flex-1 rounded-xl bg-gray-900 py-2.5 text-sm font-bold text-white transition hover:bg-gray-700 disabled:opacity-40"
                        >
                          {saving ? 'Saving…' : 'Save changes'}
                        </button>
                      </div>
                    </div>
                  </SurfaceCard>
                )}
              </>
            )}
          </div>

          {/* Right column — reviewer panel + withdraw */}
          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            {showContractAssessment &&
              (contractCheck.isLoading || contractCheck.result || contractCheck.error) && (
                <SurfaceCard className="p-4">
                  <CheckerResultPanel
                    result={contractCheck.result}
                    isLoading={contractCheck.isLoading}
                    error={contractCheck.error}
                    feature="contract-checker"
                  />
                </SurfaceCard>
              )}
            <ReviewerPanel internship={internship} />

            {['applied', 'offer_pending_review', 'offer_changes_requested'].includes(
              internship.status
            ) && (
              <SurfaceCard className="p-4">
                {!withdrawConfirming ? (
                  <button
                    type="button"
                    onClick={() => setWithdrawConfirming(true)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                  >
                    Withdraw application
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-gray-700">
                      Withdraw this application?
                    </p>
                    <p className="text-xs leading-relaxed text-gray-400">
                      This cannot be undone. You will need to apply again if you change your mind.
                    </p>
                    {withdrawError && (
                      <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                        {withdrawError}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWithdrawConfirming(false)
                          setWithdrawError(null)
                        }}
                        disabled={withdrawing}
                        className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="flex-1 rounded-xl bg-red-600 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {withdrawing ? 'Withdrawing…' : 'Confirm'}
                      </button>
                    </div>
                  </div>
                )}
              </SurfaceCard>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}
