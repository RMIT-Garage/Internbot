'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { AlertTriangle, Building2, Clock3, FileText, ShieldCheck, User } from 'lucide-react'
import { AIInsightCard, CoordinatorPageHeader, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge, type CoordinatorStatus } from '@/components/student/StatusBadge'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipResponse } from '@/lib/api/openapi-client'
import { formatDate } from '@/lib/utils'

function internshipStatusToBadge(status: InternshipResponse['status']): CoordinatorStatus {
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

function statusInsight(status: InternshipResponse['status']): string {
  switch (status) {
    case 'offer_approved':
      return 'Your application has been approved by the coordinator.'
    case 'offer_pending_review':
      return 'Your offer is currently under coordinator review.'
    case 'offer_changes_requested':
      return 'The coordinator has requested changes to your submission.'
    case 'rejected':
      return 'Your application was not approved. Check the feedback below.'
    default:
      return 'Your application has been submitted. Upload your offer letter when ready.'
  }
}

export default function StudentJobDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const id = Array.isArray(params.id) ? (params.id[0] ?? '') : (params.id ?? '')

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
        if (active) setError(err instanceof Error ? err.message : 'Failed to load application')
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
        eyebrow="My Application"
        title={loading ? 'Loading...' : (internship?.opportunityJobTitle ?? 'Not found')}
        description={
          loading ? 'Fetching application details...' : (internship?.opportunityEmployerName ?? '')
        }
        actions={
          <Link
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            href="/student/jobs"
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
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_320px]">
          <div className="space-y-6">
            <SurfaceCard className="p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-950">Application Details</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Submitted {formatDate(internship.lastSubmittedAt ?? internship.createdAt)}
                  </p>
                </div>
                <StatusBadge status={internshipStatusToBadge(internship.status)} />
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {(
                  [
                    [User, 'Role', internship.opportunityJobTitle],
                    [Building2, 'Employer', internship.opportunityEmployerName],
                    [FileText, 'Program', internship.studentProgramCode ?? 'N/A'],
                    [Clock3, 'Type', internship.opportunityType.replace('_', ' ')],
                  ] as const
                ).map(([Icon, label, value]) => (
                  <div key={label} className="rounded-2xl bg-slate-50 p-4">
                    <Icon className="h-4 w-4 text-red-700" />
                    <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            {internship.opportunitySourceUrl && (
              <SurfaceCard className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                  <ShieldCheck className="h-5 w-5 text-red-700" />
                  Opportunity Source
                </h2>
                <a
                  href={internship.opportunitySourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 block truncate text-sm text-red-600 hover:underline"
                >
                  {internship.opportunitySourceUrl}
                </a>
              </SurfaceCard>
            )}

            {internship.coordinatorComment && (
              <SurfaceCard className="p-6">
                <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Coordinator Feedback
                </h2>
                <p className="mt-3 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  {internship.coordinatorComment}
                </p>
              </SurfaceCard>
            )}
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
            <AIInsightCard
              title="Application Status"
              confidence={
                internship.status === 'offer_approved'
                  ? 100
                  : internship.status === 'offer_pending_review'
                    ? 60
                    : 30
              }
              insight={statusInsight(internship.status)}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
