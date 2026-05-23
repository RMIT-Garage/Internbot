'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, FileText, Paperclip, UploadCloud, X } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { InternshipsService } from '@/lib/api/openapi-client'
import type {
  InternshipResponse,
  CreateInternshipAttachmentUploadIntentRequest,
} from '@/lib/api/openapi-client'
import { formatDate } from '@/lib/utils'

const ACCEPTED_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'png',
  'image/jpeg': 'jpeg',
}
const MAX_BYTES = 25 * 1024 * 1024

type StepStatus = 'completed' | 'in_progress' | 'pending' | 'changes_requested'

interface WorkflowStep {
  title: string
  description: string
  status: StepStatus
}

function getWorkflowSteps(
  status: InternshipResponse['status'],
  hasFinalized: boolean
): WorkflowStep[] {
  return [
    {
      title: 'Application Submitted',
      description: 'You have successfully applied to this opportunity.',
      status: 'completed',
    },
    {
      title: 'Submit Offer Documents',
      description:
        status === 'offer_changes_requested'
          ? 'Your coordinator has requested changes. Update your documents and resubmit.'
          : 'Upload your offer letter and submit to your coordinator for review.',
      status:
        status === 'offer_changes_requested'
          ? 'changes_requested'
          : status === 'applied'
            ? hasFinalized
              ? 'in_progress'
              : 'pending'
            : 'completed',
    },
    {
      title: 'Coordinator Review',
      description: 'Your coordinator will review your submitted offer documents.',
      status:
        status === 'offer_pending_review'
          ? 'in_progress'
          : status === 'offer_approved' || status === 'rejected'
            ? 'completed'
            : 'pending',
    },
    {
      title: 'Placement Confirmed',
      description: 'Your internship placement has been approved and confirmed.',
      status: status === 'offer_approved' ? 'completed' : 'pending',
    },
  ]
}

const stepCircleClass: Record<StepStatus, string> = {
  completed: 'bg-red-600 text-white border-red-600',
  in_progress: 'border border-red-300 bg-red-50 text-red-600',
  changes_requested: 'border border-amber-400 bg-amber-50 text-amber-600',
  pending: 'border border-gray-200 bg-white text-gray-400',
}

function WorkflowTracker({
  status,
  hasFinalized,
}: {
  status: InternshipResponse['status']
  hasFinalized: boolean
}) {
  const steps = getWorkflowSteps(status, hasFinalized)
  return (
    <SurfaceCard className="p-5">
      <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-red-600 uppercase">
        Review Process
      </p>
      <h2 className="mb-5 text-base font-bold text-black">What happens next?</h2>

      <div className="border-t border-gray-100 pt-5">
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${stepCircleClass[step.status]}`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && <div className="mt-1 h-8 w-px bg-gray-200" />}
            </div>
            <div className="pt-0.5 pb-5">
              <p
                className={`text-sm leading-none font-semibold ${
                  step.status === 'pending' ? 'text-gray-400' : 'text-black'
                }`}
              >
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
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
  // Guards background polls so they stop setting state after unmount.
  const mountedRef = useRef(true)

  // Offer submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Attachment view/download state
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null)

  useEffect(() => {
    if (authLoading || !user || !id) return
    let active = true
    const run = async () => {
      try {
        setLoading(true)
        const data = await InternshipsService.getInternship(id)
        if (active) setInternship(data)
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

  // Refresh the internship in the background until the OBJECT_FINALIZE worker
  // flips the just-uploaded attachment to "finalized". The window is generous:
  // on cold starts the Eventarc finalize can take well beyond the old 30s blocking
  // budget, which used to leave the row stuck on "Processing…" until a manual refresh.
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

      // The upload-intent already pre-wrote the attachment row as "uploading", so
      // one immediate refresh surfaces it right away (shown as "Processing…").
      const refreshed = await InternshipsService.getInternship(id)
      setInternship(refreshed)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''

      // Keep watching in the background so the row flips to "Uploaded" on its own.
      void pollAttachmentFinalized(intent.attachmentId)
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
      const updated = await InternshipsService.submitInternshipOffer(id, {})
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

  const handleViewAttachment = async (attachmentId: string) => {
    if (!id) return
    setOpeningAttachmentId(attachmentId)
    try {
      const { downloadUrl } = await InternshipsService.getInternshipAttachment(id, attachmentId)
      window.open(downloadUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setUploadError('Could not open the document. Please try again.')
    } finally {
      setOpeningAttachmentId(null)
    }
  }

  const hasFinalized = internship?.attachments.some((a) => a.uploadStatus === 'finalized') ?? false

  const canAct =
    internship !== null && ['applied', 'offer_changes_requested'].includes(internship.status)

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
            onClick={() => { setError(null); setRetryCount((c) => c + 1) }}
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
              <Skeleton className="mt-4 h-10 rounded-2xl" />
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-5 w-40" />
            <div className="mt-5 space-y-4 border-t border-gray-100 pt-5">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 rounded-xl" />)}
            </div>
          </SurfaceCard>
        </div>
      )}

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
                  {internship.attachments.map((att) => {
                    const isFinalized = att.uploadStatus === 'finalized'
                    return (
                      <div
                        key={att.id}
                        className="flex items-center gap-3 rounded-2xl border border-black/20 bg-black/5 px-4 py-3"
                      >
                        <Paperclip className="h-4 w-4 shrink-0 text-black/30" />
                        {isFinalized ? (
                          <button
                            type="button"
                            onClick={() => handleViewAttachment(att.id)}
                            disabled={openingAttachmentId === att.id}
                            title="View or download document"
                            className="min-w-0 flex-1 truncate text-left text-sm font-medium text-black underline-offset-2 transition hover:text-red-700 hover:underline disabled:opacity-50"
                          >
                            {openingAttachmentId === att.id ? 'Opening…' : (att.fileName ?? att.id)}
                          </button>
                        ) : (
                          <span className="min-w-0 flex-1 truncate text-sm font-medium text-black">
                            {att.fileName ?? att.id}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            isFinalized ? 'bg-black/10 text-black' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {isFinalized ? 'Uploaded' : 'Processing...'}
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
                    )
                  })}
                </div>
              )}

              {/* Upload section */}
              {canAct && (
                <div className="mt-4 space-y-3">
                  {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    aria-label="Select offer document"
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={uploading}
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
                      disabled={uploading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 bg-white py-3 text-sm font-semibold text-black/70 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <UploadCloud className="h-4 w-4" />
                      Choose offer document
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
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

            {/* Submit to Coordinator */}
            {canAct && (
              <SurfaceCard className="p-6">
                <h2 className="text-xl font-bold text-black">Submit for Review</h2>
                <p className="mt-1 text-sm text-black/50">
                  {hasFinalized
                    ? 'Your offer document is ready. Submit it to your coordinator for review.'
                    : 'Upload at least one offer document above before submitting for review.'}
                </p>

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

          {/* Right column — workflow tracker */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <WorkflowTracker status={internship.status} hasFinalized={hasFinalized} />
          </aside>
        </div>
      )}
    </div>
  )
}
