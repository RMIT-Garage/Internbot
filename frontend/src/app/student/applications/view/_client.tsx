'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  Paperclip,
  UploadCloud,
  X,
} from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { InternshipsService } from '@/lib/api/openapi-client'
import type {
  InternshipResponse,
  CreateInternshipAttachmentUploadIntentRequest,
} from '@/lib/api/openapi-client'
import { apiFetch } from '@/lib/api/client'
import { formatDate } from '@/lib/utils'

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

function getStages(status: InternshipResponse['status']): Stage[] {
  const isRejected = status === 'rejected'
  const pastApplied = status !== 'applied'
  const pastSubmit = status === 'offer_pending_review' || status === 'offer_approved' || isRejected
  const isReviewing = status === 'offer_pending_review'
  const isApproved = status === 'offer_approved'
  const isChanges = status === 'offer_changes_requested'

  return [
    { label: 'Applied', status: 'completed' },
    {
      label: 'Offer Submitted',
      status: isChanges
        ? 'changes_requested'
        : isRejected
          ? 'rejected'
          : pastSubmit
            ? 'completed'
            : pastApplied
              ? 'active'
              : 'pending',
    },
    {
      label: 'Under Review',
      status: isRejected
        ? 'rejected'
        : isApproved
          ? 'completed'
          : isReviewing
            ? 'active'
            : 'pending',
    },
    {
      label: 'Confirmed',
      status: isApproved ? 'completed' : isRejected ? 'rejected' : 'pending',
    },
  ]
}

function StageBar({ status }: { status: InternshipResponse['status'] }) {
  const stages = getStages(status)
  return (
    <SurfaceCard className="px-6 py-4">
      <div className="flex items-center gap-0">
        {stages.map((stage, i) => {
          const isLast = i === stages.length - 1
          const dotClass =
            stage.status === 'completed'
              ? 'bg-red-600 text-white'
              : stage.status === 'active'
                ? 'bg-red-50 text-red-600 ring-2 ring-red-400'
                : stage.status === 'changes_requested'
                  ? 'bg-amber-50 text-amber-600 ring-2 ring-amber-400'
                  : stage.status === 'rejected'
                    ? 'bg-red-900 text-white'
                    : 'bg-white text-gray-300 ring-1 ring-gray-200'
          const labelClass =
            stage.status === 'completed' || stage.status === 'active'
              ? 'text-black font-semibold'
              : stage.status === 'changes_requested'
                ? 'text-amber-700 font-semibold'
                : stage.status === 'rejected'
                  ? 'text-red-900 font-semibold'
                  : 'text-gray-400'
          const lineClass = stage.status === 'completed' ? 'bg-red-600' : 'bg-gray-200'

          return (
            <div key={stage.label} className="flex min-w-0 flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${stages[i - 1]!.status === 'completed' ? 'bg-red-600' : 'bg-gray-200'}`}
                  />
                )}
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dotClass}`}
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
                {!isLast && <div className={`h-0.5 flex-1 ${lineClass}`} />}
              </div>
              <p className={`mt-2 text-center text-xs ${labelClass}`}>{stage.label}</p>
            </div>
          )
        })}
      </div>
    </SurfaceCard>
  )
}

function ReviewerPanel({ internship }: { internship: InternshipResponse }) {
  const { coordinatorDecision, coordinatorComment, reviewedAt } = internship

  const decisionConfig: Record<
    NonNullable<InternshipResponse['coordinatorDecision']>,
    { label: string; bg: string; text: string; border: string }
  > = {
    approved: {
      label: 'Approved',
      bg: 'bg-green-50',
      text: 'text-green-800',
      border: 'border-green-200',
    },
    rejected: {
      label: 'Rejected',
      bg: 'bg-red-50',
      text: 'text-red-800',
      border: 'border-red-200',
    },
    changes_requested: {
      label: 'Changes Requested',
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      border: 'border-amber-200',
    },
  }

  const cfg = coordinatorDecision ? decisionConfig[coordinatorDecision] : null

  return (
    <SurfaceCard className="p-5">
      <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-red-600 uppercase">
        Coordinator Review
      </p>
      <h2 className="mb-4 text-base font-bold text-black">Reviewer Notes & Decision</h2>

      {!coordinatorDecision ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-5 text-center">
          <Clock className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm font-medium text-gray-500">Awaiting coordinator review</p>
          <p className="mt-1 text-xs text-gray-400">
            Your coordinator will review your submitted offer documents.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className={`rounded-xl border px-4 py-3 ${cfg!.bg} ${cfg!.border}`}>
            <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">Decision</p>
            <p className={`mt-1 text-sm font-bold ${cfg!.text}`}>{cfg!.label}</p>
            {reviewedAt && <p className="mt-1 text-xs text-gray-400">{formatDate(reviewedAt)}</p>}
          </div>
          {coordinatorComment ? (
            <div>
              <p className="mb-1.5 text-xs font-bold tracking-wide text-gray-500 uppercase">
                Reviewer Notes
              </p>
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-700">
                {coordinatorComment}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No additional notes from the reviewer.</p>
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

  // Offer submission state
  const [offerDate, setOfferDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

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
    if (!id || !offerDate || !startDate) return
    setSubmitError(null)
    try {
      setSubmitting(true)
      const updated = await InternshipsService.submitInternshipOffer(id, {
        offerDate,
        startDate,
        endDate: endDate || null,
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

  const hasFinalized = internship?.attachments.some((a) => a.uploadStatus === 'finalized') ?? false
  const hasProcessing = internship?.attachments.some((a) => a.uploadStatus !== 'finalized') ?? false

  const canAct =
    internship !== null && ['applied', 'offer_changes_requested'].includes(internship.status)

  const canSubmitToCoordinator = canAct && hasFinalized && offerDate !== '' && startDate !== ''

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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* Left column — main content */}
          <div className="space-y-6">
            {/* Offer Documents */}
            <SurfaceCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-black">Offer Documents</h2>
                  {internship.lastSubmittedAt && (
                    <p className="mt-1 text-sm text-black/60">
                      Last submitted {formatDate(internship.lastSubmittedAt)}
                    </p>
                  )}
                </div>
                <StatusBadge status={internship.status as StudentStatus} />
              </div>

              {internship.attachments.length === 0 ? (
                <div className="mt-6 flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-black/5 p-6 text-center">
                  <FileText className="h-10 w-10 text-black/30" />
                  <p className="mt-3 text-sm text-black/50">No offer documents uploaded yet.</p>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {internship.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center gap-3 rounded-2xl border border-black/20 bg-black/5 px-4 py-3"
                    >
                      <Paperclip className="h-4 w-4 shrink-0 text-black/30" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                        {att.fileName ?? att.id}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          att.uploadStatus === 'finalized'
                            ? 'bg-black/10 text-black'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {att.uploadStatus === 'finalized' ? 'Uploaded' : 'Confirming upload...'}
                      </span>
                      {canAct && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          disabled={deletingAttachmentId === att.id}
                          aria-label={`Remove ${att.fileName ?? att.id}`}
                          className="shrink-0 text-black/30 transition hover:text-red-600 disabled:opacity-40"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Upload section */}
              {canAct && (
                <div className="mt-4 space-y-3">
                  {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

                  {hasProcessing && !uploading && (
                    <p className="text-xs text-amber-700">
                      Waiting for your previous upload to confirm before you can add another
                      document.
                    </p>
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
                    <div className="flex items-center gap-3 rounded-2xl border border-black/20 bg-black/5 px-4 py-3">
                      <Paperclip className="h-4 w-4 shrink-0 text-black/40" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                        {selectedFile.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          setUploadError(null)
                          if (fileInputRef.current) fileInputRef.current.value = ''
                        }}
                        className="shrink-0 text-black/30 hover:text-black/60"
                        aria-label="Remove selected file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || hasProcessing}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 bg-white py-3 text-sm font-semibold text-black/70 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Choose offer document
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading || hasProcessing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-black/20 bg-white py-3 text-sm font-bold text-black transition hover:bg-black/5 disabled:opacity-40"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>

                  <p className="text-center text-xs text-black/40">
                    Accepted: PDF, DOC/DOCX, PNG, JPEG. Max 25 MB.
                  </p>
                </div>
              )}
            </SurfaceCard>

            {/* Offer Details + Submit to Coordinator */}
            {canAct && (
              <SurfaceCard className="p-6">
                <h2 className="text-xl font-bold text-black">Offer Details</h2>
                <p className="mt-1 text-sm text-black/50">
                  Fill in your offer details and submit to your coordinator for review. You must
                  have at least one uploaded document.
                </p>

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-black/60" htmlFor="offerDate">
                      Offer date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="offerDate"
                      type="date"
                      value={offerDate}
                      onChange={(e) => setOfferDate(e.target.value)}
                      className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-black/60" htmlFor="startDate">
                      Start date <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-black/60" htmlFor="endDate">
                      End date
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                {submitError && <p className="mt-3 text-sm text-red-600">{submitError}</p>}

                <button
                  type="button"
                  onClick={handleSubmitToCoordinator}
                  disabled={!canSubmitToCoordinator || submitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
                >
                  {submitting ? 'Submitting...' : 'Submit to Coordinator'}
                </button>
              </SurfaceCard>
            )}

            {internship.coordinatorComment && (
              <SurfaceCard className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-black">
                  <AlertTriangle className="h-5 w-5 text-red-700" />
                  Coordinator Feedback
                </h2>
                <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm leading-6 text-red-900">
                  {internship.coordinatorComment}
                </p>
              </SurfaceCard>
            )}
          </div>

          {/* Right column — reviewer notes & decision */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <ReviewerPanel internship={internship} />
          </aside>
        </div>
      )}
    </div>
  )
}
