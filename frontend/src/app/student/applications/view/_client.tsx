'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, FileText, Paperclip, UploadCloud } from 'lucide-react'
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
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !id) return

    setUploadError(null)

    if (!ACCEPTED_TYPES[file.type]) {
      setUploadError('Unsupported file type. Please upload a PDF, DOC/DOCX, PNG, or JPEG.')
      return
    }
    if (file.size > MAX_BYTES) {
      setUploadError('File exceeds the 25 MB limit.')
      return
    }

    try {
      setUploading(true)

      const intent = await apiFetch<UploadIntentResponse>(
        `/api/v1/internships/${id}/attachments/upload-intents`,
        { method: 'POST', body: { fileName: file.name, contentType: file.type } }
      )

      const putRes = await fetch(intent.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`)
      }

      // Poll until the OBJECT_FINALIZE event flips the attachment to finalized (max 30s)
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 1500))
        const updated = await InternshipsService.getInternship(id)
        setInternship(updated)
        const att = updated.attachments.find((a) => a.id === intent.attachmentId)
        if (att?.uploadStatus === 'finalized') break
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
                  </div>
                ))}
              </div>
            )}

            {/* Upload button — only shown when student can still act */}
            {['applied', 'offer_changes_requested'].includes(internship.status) && (
              <div className="mt-4">
                {uploadError && <p className="mb-2 text-sm text-red-600">{uploadError}</p>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  aria-label="Upload offer document"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/20 bg-white py-3 text-sm font-semibold text-black/70 transition hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                >
                  <UploadCloud className="h-4 w-4" />
                  {uploading ? 'Uploading...' : 'Upload offer document'}
                </button>
                <p className="mt-2 text-center text-xs text-black/40">
                  Accepted: PDF, DOC/DOCX, PNG, JPEG. Max 25 MB.
                </p>
              </div>
            )}
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
      )}
    </div>
  )
}
