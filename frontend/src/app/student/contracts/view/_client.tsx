'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, Calendar, FileText, Paperclip, Trash2, UploadCloud } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipResponse } from '@/lib/api/openapi-client'
import { CreateInternshipAttachmentUploadIntentRequest } from '@/api/models/CreateInternshipAttachmentUploadIntentRequest'
import { getApiErrorMessage, getApiErrorReason } from '@/lib/api/errors'
import { formatDate } from '@/lib/utils'

type AllowedContentType = CreateInternshipAttachmentUploadIntentRequest.contentType

const ACCEPTED_CONTENT_TYPES: ReadonlyArray<AllowedContentType> = [
  CreateInternshipAttachmentUploadIntentRequest.contentType.APPLICATION_PDF,
  CreateInternshipAttachmentUploadIntentRequest.contentType.IMAGE_PNG,
  CreateInternshipAttachmentUploadIntentRequest.contentType.IMAGE_JPEG,
  CreateInternshipAttachmentUploadIntentRequest.contentType.APPLICATION_MSWORD,
  CreateInternshipAttachmentUploadIntentRequest.contentType
    .APPLICATION_VND_OPENXMLFORMATS_OFFICEDOCUMENT_WORDPROCESSINGML_DOCUMENT,
]

const ACCEPT_ATTR = ACCEPTED_CONTENT_TYPES.join(',')

// 25 MB — keeps a roomy upper bound while preventing accidental huge uploads.
// The backend enforces its own limit too; this is just an early client guard.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const SUBMIT_CONFLICT_MESSAGES: Record<string, string> = {
  no_offer_attachment: 'Upload at least one offer document before submitting for review.',
  internship_not_submittable: 'This application is no longer in a state that can be submitted.',
  missing_offer_dates: 'Provide an offer date and start date before submitting.',
}

function internshipStatusToBadge(status: InternshipResponse['status']): StudentStatus {
  switch (status) {
    case 'applied':
      return 'applied'
    case 'offer_pending_review':
      return 'offer_pending_review'
    case 'offer_changes_requested':
      return 'offer_changes_requested'
    case 'offer_approved':
      return 'offer_approved'
    case 'rejected':
      return 'rejected'
    default:
      return 'applied'
  }
}

function isEditableStatus(status: InternshipResponse['status']) {
  return status === 'applied' || status === 'offer_changes_requested'
}

function isAcceptedContentType(type: string): type is AllowedContentType {
  return (ACCEPTED_CONTENT_TYPES as ReadonlyArray<string>).includes(type)
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function fromDateInputValue(date: string): string | null {
  if (!date) return null
  // Submit at noon UTC so timezone wobble never tips into the previous day.
  return new Date(`${date}T12:00:00.000Z`).toISOString()
}

export default function StudentContractDetailPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [internship, setInternship] = useState<InternshipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [offerDate, setOfferDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        const data = await InternshipsService.getInternship(id)
        if (active) {
          setInternship(data)
          setOfferDate(toDateInputValue(data.offerDate))
          setStartDate(toDateInputValue(data.startDate))
          setEndDate(toDateInputValue(data.endDate))
        }
      } catch (err: unknown) {
        if (active) setError(getApiErrorMessage(err, 'Failed to load contract'))
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user, id])

  const refreshInternship = async () => {
    const fresh = await InternshipsService.getInternship(id)
    setInternship(fresh)
    return fresh
  }

  const handleFilePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Reset so picking the same file again still re-fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!file || !internship) return

    setUploadError(null)

    if (!isAcceptedContentType(file.type)) {
      setUploadError('Unsupported file type. Use PDF, DOC/DOCX, PNG, or JPEG.')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError('File is too large (max 25 MB).')
      return
    }

    try {
      setUploading(true)
      const intent = await InternshipsService.createInternshipAttachmentUploadIntent(
        internship.id,
        {
          fileName: file.name,
          contentType: file.type,
        }
      )

      const putRes = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': intent.contentType },
        body: file,
      })

      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`)
      }

      // The GCS finalize event flips the attachment row to `finalized` shortly
      // after the PUT lands. Refetch so the list reflects the new row, even if
      // it's still showing as `uploading`.
      await refreshInternship()
    } catch (err: unknown) {
      setUploadError(getApiErrorMessage(err, 'Failed to upload file'))
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!internship) return
    setUploadError(null)
    setDeletingId(attachmentId)
    try {
      await InternshipsService.deleteInternshipAttachment(internship.id, attachmentId)
      await refreshInternship()
    } catch (err: unknown) {
      setUploadError(getApiErrorMessage(err, 'Failed to delete attachment'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSubmitForReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!internship) return
    setSubmitError(null)
    setSubmitSuccess(null)

    const offerIso = fromDateInputValue(offerDate)
    const startIso = fromDateInputValue(startDate)
    const endIso = endDate ? fromDateInputValue(endDate) : null

    if (!offerIso || !startIso) {
      setSubmitError('Provide an offer date and start date before submitting.')
      return
    }

    try {
      setSubmitting(true)
      await InternshipsService.submitInternshipOffer(internship.id, {
        offerDate: offerIso,
        startDate: startIso,
        ...(endIso ? { endDate: endIso } : {}),
      })
      await refreshInternship()
      setSubmitSuccess('Offer submitted for coordinator review.')
    } catch (err: unknown) {
      const reason = getApiErrorReason(err)
      setSubmitError(
        (reason && SUBMIT_CONFLICT_MESSAGES[reason]) ??
          getApiErrorMessage(err, 'Failed to submit for review')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const editable = internship ? isEditableStatus(internship.status) : false
  const finalizedAttachments = internship?.attachments.filter((a) => a.uploadStatus === 'finalized')
  const hasFinalizedAttachment = (finalizedAttachments?.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="My Contract"
        title={loading ? 'Loading...' : (internship?.opportunityJobTitle ?? 'Not found')}
        description={
          loading ? 'Fetching contract details...' : (internship?.opportunityEmployerName ?? '')
        }
        actions={
          <Link
            className="rounded-xl border border-black/20 bg-white px-4 py-2 text-sm font-bold text-black hover:bg-black/5"
            href="/student/contracts"
          >
            Back to contracts
          </Link>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {loading && (
        <div
          className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]"
          aria-busy="true"
          aria-live="polite"
        >
          <p className="sr-only">Loading contract details…</p>
          <div className="space-y-6">
            <SurfaceCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-40 bg-slate-200" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
              <div className="mt-6 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12 rounded-2xl bg-slate-50" />
                ))}
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-6">
              <Skeleton className="h-5 w-40 bg-slate-200" />
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl bg-slate-50" />
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {!loading && internship && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <div className="space-y-6">
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
                <StatusBadge status={internshipStatusToBadge(internship.status)} />
              </div>

              {internship.attachments.length === 0 ? (
                <div className="mt-6 flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/20 bg-black/5 p-6 text-center">
                  <FileText className="h-10 w-10 text-black/30" />
                  <p className="mt-3 text-sm text-black/50">No offer documents uploaded yet.</p>
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {internship.attachments.map((att) => {
                    const isDeleting = deletingId === att.id
                    return (
                      <li
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
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {att.uploadStatus === 'finalized' ? 'Uploaded' : 'Uploading'}
                        </span>
                        {editable && (
                          <button
                            type="button"
                            aria-label="Delete attachment"
                            onClick={() => handleDeleteAttachment(att.id)}
                            disabled={isDeleting || uploading}
                            className="rounded-lg p-1.5 text-black/40 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {editable && (
                <div className="mt-4 space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPT_ATTR}
                    className="hidden"
                    onChange={handleFilePicked}
                    disabled={uploading}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-black/30 bg-white py-3 text-sm font-bold text-black transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UploadCloud className="h-4 w-4" />
                    {uploading ? 'Uploading…' : 'Upload offer document'}
                  </button>
                  <p className="text-xs text-black/50">
                    Accepted: PDF, DOC/DOCX, PNG, JPEG. Max 25 MB.
                  </p>
                  {uploadError && (
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      {uploadError}
                    </div>
                  )}
                </div>
              )}
            </SurfaceCard>

            {editable && (
              <SurfaceCard className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-black">
                  <Calendar className="h-5 w-5 text-red-700" />
                  Submit Offer for Review
                </h2>
                <p className="mt-1 text-sm text-black/60">
                  Provide your placement dates and submit your offer documents for coordinator
                  review.
                </p>

                <form onSubmit={handleSubmitForReview} className="mt-4 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="grid gap-1 text-xs font-bold tracking-wide text-black/60 uppercase">
                      Offer date
                      <input
                        type="date"
                        required
                        value={offerDate}
                        onChange={(e) => setOfferDate(e.target.value)}
                        className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:border-red-500 focus:outline-none"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold tracking-wide text-black/60 uppercase">
                      Start date
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:border-red-500 focus:outline-none"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold tracking-wide text-black/60 uppercase">
                      End date <span className="text-black/40">(optional)</span>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black focus:border-red-500 focus:outline-none"
                      />
                    </label>
                  </div>

                  {!hasFinalizedAttachment && (
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      Upload at least one offer document before submitting.
                    </div>
                  )}

                  {submitError && (
                    <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
                      {submitError}
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="rounded-xl bg-green-50 px-3 py-2 text-sm text-green-700">
                      {submitSuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !hasFinalizedAttachment}
                    className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? 'Submitting…' : 'Submit for review'}
                  </button>
                </form>
              </SurfaceCard>
            )}

            <SurfaceCard className="p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold text-black">
                <Calendar className="h-5 w-5 text-red-700" />
                Placement Details
              </h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {(
                  [
                    ['Offer date', internship.offerDate ? formatDate(internship.offerDate) : '—'],
                    ['Start date', internship.startDate ? formatDate(internship.startDate) : '—'],
                    ['End date', internship.endDate ? formatDate(internship.endDate) : '—'],
                    ['Type', internship.opportunityType.replace('_', ' ')],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-black/5 p-4">
                    <p className="text-xs font-bold tracking-wide text-black/60 uppercase">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-black capitalize">{value}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

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
        </div>
      )}
    </div>
  )
}
