import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AlertTriangle, FileText, History, MessageSquareText, ShieldCheck } from 'lucide-react'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { ReviewDecisionPanel } from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { contractApprovals, getContractApproval, recentActivity } from '@/lib/coordinator/mockData'
import { formatDate } from '@/lib/utils'

interface ContractReviewPageProps {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return contractApprovals.map((contract) => ({ id: contract.id }))
}

export default async function CoordinatorContractReviewPage({ params }: ContractReviewPageProps) {
  const { id } = await params
  const contract = getContractApproval(id)

  if (!contract) notFound()

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Contract Review"
        title={contract.documentName}
        description={`${contract.studentName} placement agreement with ${contract.placementHost}.`}
        actions={
          <Link
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            href="/coordinator/contracts"
          >
            Back to queue
          </Link>
        }
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
              <TimelineFeed items={recentActivity.slice(0, 3)} />
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <AIInsightCard
            title="AI Insights"
            confidence={contract.aiConfidence ?? 86}
            insight={`Institutional checks found ${contract.aiIssues.length} review signals. Risk level is ${contract.riskLevel ?? 'Low'} based on clause coverage, signatures, and date alignment.`}
          />

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
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
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
              canReview={contract.status === 'pending'}
              reviewedStatus={contract.status}
              backHref="/coordinator/contracts"
            />
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}
