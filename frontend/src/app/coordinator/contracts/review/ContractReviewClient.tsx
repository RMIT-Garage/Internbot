'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, FileText, History, MessageSquareText, ShieldCheck } from 'lucide-react'
import { CoordinatorPageHeader, SurfaceCard, TimelineFeed } from '@/components/coordinator/Premium'
import {
  ReviewDecisionPanel,
  type ReviewDecision,
} from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getInternship } from '@/lib/coordinator/api'
import { mapInternshipToContractApproval } from '@/lib/coordinator/apiMappers'
import {
  recentActivity,
  type ApprovalStatus,
  type ContractApproval,
  type WorkflowTone,
} from '@/lib/coordinator/mockData'
import { formatDate } from '@/lib/utils'
import type { InternshipStatus } from '@/types/api'

export function ContractReviewClient() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const [contract, setContract] = useState<ContractApproval | null>(null)
  const [loading, setLoading] = useState(Boolean(id))
  const [error, setError] = useState<string | null>(null)
  const [timeline, setTimeline] = useState(recentActivity.slice(0, 3))
  const [backendStatus, setBackendStatus] = useState<InternshipStatus | null>(null)

  useEffect(() => {
    let active = true

    if (!id) return

    queueMicrotask(() => {
      if (!active) return
      setLoading(true)
      setError(null)
    })
    getInternship(id)
      .then((internship) => {
        if (!active) return
        setBackendStatus(internship.status)
        setContract(mapInternshipToContractApproval(internship))
      })
      .catch((err: unknown) => {
        if (!active) return
        setContract(null)
        setError(
          err instanceof Error
            ? `Unable to load this contract from the workflow API: ${err.message}`
            : 'Unable to load this contract from the workflow API.'
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
      />
    )
  }

  if (loading) {
    return (
      <ReviewNotice title="Loading contract review" message="Fetching the selected internship." />
    )
  }

  if (!contract) {
    return (
      <ReviewNotice
        title="Contract review unavailable"
        message={error ?? 'The selected contract was not found in the workflow API.'}
      />
    )
  }

  const refreshContract = async () => {
    const internship = await getInternship(contract.id)
    const mapped = mapInternshipToContractApproval(internship)
    setBackendStatus(internship.status)
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
    setTimeline((current) => [
      {
        title: decisionToTimelineTitle(decision),
        description: notes || 'Coordinator decision submitted to the workflow API.',
        time: 'Just now',
        tone: decisionToTimelineTone(decision),
      },
      ...current,
    ])
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Contract Review"
        title={contract.documentName}
        description={`${contract.studentName} placement agreement with ${contract.placementHost}.`}
        actions={<BackLink href="/coordinator/contracts">Back to queue</BackLink>}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_420px]">
        <div className="space-y-6">
          <SurfaceCard className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-950">Document Preview</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted {formatDate(contract.submissionDate)}
                </p>
              </div>
              <StatusBadge status={contract.status} />
            </div>
            <div className="mt-6 flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
              <FileText className="h-14 w-14 text-red-700" />
              <h3 className="mt-4 text-lg font-bold text-slate-950">Contract file preview</h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                File rendering, signatures, clauses, version history, and annotations will appear in
                this institutional review pane.
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Student and Host Details</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['Student', `${contract.studentName} (${contract.studentId})`],
                ['Course', contract.course],
                ['Semester', contract.semester],
                ['Placement host', contract.placementHost],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-slate-50 p-4">
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
              <History className="h-5 w-5 text-red-700" />
              Audit Activity
            </h2>
            <div className="mt-4">
              <TimelineFeed items={timeline} />
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <ShieldCheck className="h-5 w-5 text-red-700" />
              Compliance Checks
            </h2>
            <div className="mt-4 space-y-2">
              {contract.aiIssues.map((issue) => (
                <div
                  key={issue}
                  className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
                  {issue}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Decision Panel
            </h2>
            <ReviewDecisionPanel
              id={contract.id}
              kind="contract"
              defaultNotes={contract.notes.join('\n')}
              canReview={backendStatus === 'offer_pending_review'}
              reviewedStatus={contract.status}
              backHref="/coordinator/contracts"
              onSuccess={handleDecisionSuccess}
              onAlreadyReviewed={refreshContract}
            />
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
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

function decisionToTimelineTitle(decision: ReviewDecision): string {
  if (decision === 'approved') return 'Contract approved'
  if (decision === 'rejected') return 'Contract rejected'
  return 'Contract changes requested'
}

function decisionToTimelineTone(decision: ReviewDecision): WorkflowTone {
  if (decision === 'approved') return 'charcoal'
  if (decision === 'rejected') return 'red'
  return 'neutral'
}

function ReviewNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Contract Review"
        title={title}
        description={message}
        actions={<BackLink href="/coordinator/contracts">Back to queue</BackLink>}
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
