'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, Calendar, FileText, Paperclip } from 'lucide-react'
import { AIInsightCard, CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type StudentStatus } from '@/components/student/StatusBadge'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipResponse } from '@/lib/api/openapi-client'
import { formatDate } from '@/lib/utils'

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

function statusInsight(status: InternshipResponse['status']): string {
  switch (status) {
    case 'offer_approved':
      return 'Your offer has been approved by your coordinator. Your placement is confirmed.'
    case 'offer_pending_review':
      return 'Your submitted offer documents are under coordinator review.'
    case 'offer_changes_requested':
      return 'The coordinator has requested changes to your submitted offer. Review the feedback and resubmit.'
    case 'rejected':
      return 'Your application was not approved. Review the coordinator feedback below.'
    default:
      return 'Submit your offer letter to begin the coordinator review process.'
  }
}

export default function StudentContractDetailPage() {
  const { user } = useAuth()
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [internship, setInternship] = useState<InternshipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user || !id) return
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        const data = await InternshipsService.getInternship(id)
        if (active) setInternship(data)
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load contract')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user, id])

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
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {att.uploadStatus === 'finalized' ? 'Uploaded' : 'Uploading'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>

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

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <AIInsightCard
              title="Contract Status"
              confidence={
                internship.status === 'offer_approved'
                  ? 100
                  : internship.status === 'offer_pending_review'
                    ? 60
                    : internship.status === 'offer_changes_requested'
                      ? 30
                      : internship.status === 'rejected'
                        ? 0
                        : 20
              }
              insight={statusInsight(internship.status)}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
