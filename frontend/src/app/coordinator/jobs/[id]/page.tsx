import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  Clock3,
  FileText,
  MessageSquareText,
  ShieldCheck,
  User,
} from 'lucide-react'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  SurfaceCard,
  TimelineFeed,
} from '@/components/coordinator/Premium'
import { ReviewDecisionPanel } from '@/components/coordinator/ReviewDecisionPanel'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { getSelfSourcedJob, recentActivity, selfSourcedJobs } from '@/lib/coordinator/mockData'
import { formatDate } from '@/lib/utils'

interface JobReviewPageProps {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return selfSourcedJobs.map((job) => ({ id: job.id }))
}

export default async function CoordinatorJobReviewPage({ params }: JobReviewPageProps) {
  const { id } = await params
  const job = getSelfSourcedJob(id)

  if (!job) notFound()

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Placement Review"
        title={job.jobTitle}
        description={`${job.studentName} submitted ${job.company} for institutional approval.`}
        actions={
          <Link
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            href="/coordinator/jobs"
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
                <h2 className="text-xl font-bold text-slate-950">Internship Information</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Submitted {formatDate(job.submissionDate)}
                </p>
              </div>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                [User, 'Student', `${job.studentName} (${job.studentId})`],
                [FileText, 'Course', job.course],
                [Clock3, 'Semester', job.semester],
                [Building2, 'Employer', job.company],
                [ShieldCheck, 'Supervisor', job.supervisor],
                [Clock3, 'Work pattern', job.workPattern],
              ].map(([Icon, label, value]) => {
                const DetailIcon = Icon as typeof User
                return (
                  <div key={label as string} className="rounded-2xl bg-slate-50 p-4">
                    <DetailIcon className="h-4 w-4 text-red-700" />
                    <p className="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      {label as string}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-950">{value as string}</p>
                  </div>
                )
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Submitted Role Description</h2>
            <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {job.description}
            </p>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Review Timeline</h2>
            <div className="mt-4">
              <TimelineFeed items={recentActivity.slice(0, 3)} />
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
          <AIInsightCard
            title="AI Insights"
            confidence={job.aiConfidence ?? 88}
            insight={job.aiAdvisory}
          />

          <SurfaceCard className="p-6">
            <h2 className="text-lg font-bold text-slate-950">Risk Analysis</h2>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">Risk level</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">{job.riskLevel ?? 'Low'}</p>
            </div>
            <div className="mt-4 space-y-2">
              {(job.concerns.length ? job.concerns : ['No concerns recorded.']).map((concern) => (
                <div
                  key={concern}
                  className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-900"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {concern}
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <MessageSquareText className="h-5 w-5 text-red-700" />
              Reviewer Notes
            </h2>
            <ReviewDecisionPanel
              id={job.id}
              kind="job"
              defaultNotes={job.notes.join('\n')}
              canReview={job.status === 'pending'}
              reviewedStatus={job.status}
              backHref="/coordinator/jobs"
            />
          </SurfaceCard>
        </aside>
      </div>
    </div>
  )
}
