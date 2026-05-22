'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, ArrowRight, Check, FileText, Paperclip, UploadCloud, X } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type CoordinatorStatus } from '@/components/student/StatusBadge'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipResponse } from '@/lib/api/openapi-client'
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

interface UploadIntentResponse {
  attachmentId: string
  filePath: string
  uploadUrl: string
  uploadExpiresAt: string
  contentType: string
}

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
          : status === 'offer_approved'
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

function StepIcon({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600">
        <Check className="h-4 w-4 text-white" strokeWidth={3} />
      </div>
    )
  }
  if (status === 'in_progress') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-black bg-white">
        <div className="h-3 w-3 rounded-full bg-black" />
      </div>
    )
  }
  if (status === 'changes_requested') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-amber-500 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
      </div>
    )
  }
  return <div className="h-9 w-9 shrink-0 rounded-full bg-black/10" />
}

function StepBadge({ status }: { status: StepStatus }) {
  const map: Record<StepStatus, { label: string; className: string }> = {
    completed: { label: 'COMPLETED', className: 'bg-red-100 text-red-700' },
    in_progress: { label: 'IN PROGRESS', className: 'bg-black/10 text-black' },
    pending: { label: 'PENDING', className: 'bg-black/10 text-black/50' },
    changes_requested: { label: 'CHANGES REQUESTED', className: 'bg-amber-100 text-amber-700' },
  }
  const { label, className } = map[status]
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${className}`}>
      {label}
    </span>
  )
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
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black">
          <ArrowRight className="h-4 w-4 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-black">Next Steps</h2>
          <p className="text-xs text-black/50">Track your internship approval process.</p>
        </div>
      </div>

      <div className="mt-5 space-y-0">
        {steps.map((step, i) => (
          <div key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <StepIcon status={step.status} />
              {i < steps.length - 1 && (
                <div className="my-1 w-px flex-1 bg-black/10" style={{ minHeight: '24px' }} />
              )}
            </div>
            <div className="pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-sm font-bold ${
                    step.status === 'pending' ? 'text-black/40' : 'text-black'
                  }`}
                >
                  {step.title}
                </span>
                <StepBadge status={step.status} />
              </div>
              <p
                className={`mt-0.5 text-xs leading-5 ${
                  step.status === 'pending' ? 'text-black/30' : 'text-black/50'
                }`}
              >
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  )
}

function statusToBadge(status: InternshipResponse['status']): CoordinatorStatus {
  switch (status) {
    case 'offer_approved':
      return 'approved'
    case 'offer_changes_requested':
      return 'changes_requested'
    case 'rejected':
      return 'rejected'
    case 'offer_pending_review':
      return 'on_track'
    default:
      return 'pending'
  }
}

export default function ApplicationDetailClient() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [internship, setInternship] = useState<InternshipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Offer submission state
  const [offerDate, setOfferDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return
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
  }, [user, id])

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

  const handleUpload = async () => {
    if (!selectedFile || !id) return
    setUploadError(null)
    try {
      setUploading(true)

      const intent = await apiFetch<UploadIntentResponse>(
        `/api/v1/internships/${id}/attachments/upload-intents`,
        { method: 'POST', body: { fileName: selectedFile.name, contentType: selectedFile.type } }
      )

      const putRes = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': selectedFile.type },
        body: selectedFile,
      })
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`)

      // Poll until the OBJECT_FINALIZE event flips the attachment to finalized (max 30s)
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500))
        const updated = await InternshipsService.getInternship(id)
        setInternship(updated)
        const att = updated.attachments.find((a) => a.id === intent.attachmentId)
        if (att?.uploadStatus === 'finalized') break
      }

      setSelectedFile(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setUploadError(
        msg === 'Failed to fetch'
          ? 'Could not reach the server. Check your connection and try again.'
          : msg || 'Upload failed. Please try again.'
      )
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
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
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
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
                <StatusBadge status={statusToBadge(internship.status)} />
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
                        {att.uploadStatus === 'finalized' ? 'Uploaded' : 'Processing...'}
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

          {/* Right column — workflow tracker */}
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <WorkflowTracker status={internship.status} hasFinalized={hasFinalized} />
          </aside>
        </div>
      )}
    </div>
  )
}
