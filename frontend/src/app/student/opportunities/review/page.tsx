'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  FileText,
  MapPin,
  Monitor,
  Paperclip,
  Star,
  X,
} from 'lucide-react'
import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OpportunitiesService } from '@/lib/api/openapi-client'
import type { OpportunityResponse } from '@/lib/api/openapi-client'
import { formatDate } from '@/lib/utils'
import { CheckerResultPanel } from '@/features/coordinator-ai/components/CheckerResultPanel'
import { useStudentJobCheck } from '@/features/coordinator-ai/hooks/useStudentJobCheck'
import type { CheckerInput } from '@/features/coordinator-ai/types'

type ReviewStage = 'completed' | 'active' | 'rejected' | 'pending'

interface Stage {
  label: string
  status: ReviewStage
}

function getStages(status: OpportunityResponse['status']): Stage[] {
  const isRejected = status === 'rejected'
  const isApproved = status === 'published'
  const isReviewing = status === 'pending_verification'

  return [
    { label: 'Submitted', status: 'completed' },
    {
      label: 'Under Review',
      status: isRejected
        ? 'rejected'
        : isApproved
          ? 'completed'
          : isReviewing
            ? 'active'
            : 'active',
    },
    {
      label: isRejected ? 'Rejected' : 'Approved',
      status: isRejected ? 'rejected' : isApproved ? 'completed' : 'pending',
    },
  ]
}

function ReviewProgressBar({ status }: { status: OpportunityResponse['status'] }) {
  const stages = getStages(status)
  const lastFilledIdx = stages.reduce((acc, s, i) => (s.status === 'completed' ? i : acc), -1)
  const progressPct = lastFilledIdx < 0 ? 0 : (lastFilledIdx / (stages.length - 1)) * 100

  return (
    <SurfaceCard className="px-8 py-6">
      <div className="relative">
        <div className="absolute top-4 right-[16.67%] left-[16.67%] h-0.5 bg-gray-200" />
        <div
          className="absolute top-4 left-[16.67%] h-0.5 bg-red-600 transition-all duration-500"
          style={{ width: `calc(${progressPct}% * 0.667)` }}
        />
        <div className="relative grid grid-cols-3">
          {stages.map((stage) => {
            const dotClass =
              stage.status === 'completed'
                ? 'bg-red-600 text-white shadow-sm shadow-red-200'
                : stage.status === 'active'
                  ? 'bg-white text-red-600 ring-2 ring-red-500 shadow-sm shadow-red-100'
                  : stage.status === 'rejected'
                    ? 'bg-red-900 text-white'
                    : 'bg-white text-gray-300 ring-1 ring-gray-200'
            const labelClass =
              stage.status === 'active'
                ? 'text-red-600 font-semibold'
                : stage.status === 'completed'
                  ? 'text-gray-700 font-medium'
                  : stage.status === 'rejected'
                    ? 'text-red-900 font-semibold'
                    : 'text-gray-400'

            return (
              <div key={stage.label} className="flex flex-col items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dotClass}`}
                >
                  {stage.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : stage.status === 'active' ? (
                    <Clock className="h-3.5 w-3.5" />
                  ) : stage.status === 'rejected' ? (
                    <X className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3 w-3" />
                  )}
                </div>
                <p className={`text-center text-xs leading-tight ${labelClass}`}>{stage.label}</p>
              </div>
            )
          })}
        </div>
      </div>
    </SurfaceCard>
  )
}

function ReviewStatusCard({ opportunity }: { opportunity: OpportunityResponse }) {
  const { status, verificationComment, verifiedAt } = opportunity

  if (status === 'rejected') {
    return (
      <SurfaceCard className="overflow-hidden p-0">
        <div className="border-b border-red-100 bg-red-50 px-5 py-4">
          <p className="text-[10px] font-bold tracking-[0.18em] text-red-600 uppercase">
            Coordinator Review
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-red-900">Submission Rejected</h2>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <p className="text-sm font-bold text-red-800">Not Approved</p>
            </div>
            {verifiedAt && (
              <p className="mt-1.5 text-xs text-gray-500">Reviewed {formatDate(verifiedAt)}</p>
            )}
          </div>
          {verificationComment && (
            <div>
              <p className="mb-2 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
                Coordinator Note
              </p>
              <p className="rounded-xl bg-gray-50 px-4 py-3 text-sm leading-6 whitespace-pre-wrap text-gray-700">
                {verificationComment}
              </p>
            </div>
          )}
        </div>
      </SurfaceCard>
    )
  }

  if (status === 'published') {
    return (
      <SurfaceCard className="overflow-hidden p-0">
        <div className="border-b border-green-100 bg-green-50 px-5 py-4">
          <p className="text-[10px] font-bold tracking-[0.18em] text-green-600 uppercase">
            Coordinator Review
          </p>
          <h2 className="mt-0.5 text-sm font-bold text-green-900">Submission Approved</h2>
        </div>
        <div className="px-5 py-4">
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <p className="text-sm font-bold text-green-800">Approved</p>
            </div>
            {verifiedAt && (
              <p className="mt-1.5 text-xs text-gray-500">Approved {formatDate(verifiedAt)}</p>
            )}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Your opportunity is now published. You can apply from the opportunities list.
          </p>
        </div>
      </SurfaceCard>
    )
  }

  return (
    <SurfaceCard className="overflow-hidden p-0">
      <div className="border-b border-gray-100 px-5 py-4">
        <p className="text-[10px] font-bold tracking-[0.18em] text-red-600 uppercase">
          Coordinator Review
        </p>
        <h2 className="mt-0.5 text-sm font-bold text-black">Review Status</h2>
      </div>
      <div className="flex flex-col items-center px-5 py-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Clock className="h-5 w-5 text-gray-400" />
        </div>
        <p className="mt-3 text-sm font-semibold text-gray-600">Awaiting review</p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          A coordinator will verify your submission before it becomes available.
        </p>
      </div>
    </SurfaceCard>
  )
}

function OpportunityReviewContent() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id') ?? ''

  const [opportunity, setOpportunity] = useState<OpportunityResponse | null>(null)
  const [loading, setLoading] = useState(!!id)
  const [error, setError] = useState<string | null>(null)
  const [checkerInput, setCheckerInput] = useState<CheckerInput | null>(null)

  const jobCheck = useStudentJobCheck(checkerInput)

  useEffect(() => {
    if (!id) return
    OpportunitiesService.getOpportunity(id)
      .then(async (opp) => {
        setOpportunity(opp)

        const opportunityText = [
          `Job Title: ${opp.jobTitle}`,
          `Employer: ${opp.employerName}`,
          `Description: ${opp.descriptionText ?? ''}`,
          `Work Mode: ${opp.workMode ?? 'unspecified'}`,
          `Location: ${opp.location ?? 'unspecified'}`,
        ].join('\n')

        const primary = opp.attachments.find((a) => a.uploadStatus === 'finalized')
        if (primary) {
          try {
            const { downloadUrl } = await OpportunitiesService.getOpportunityAttachment(
              id,
              primary.id
            )
            const res = await fetch(downloadUrl)
            if (res.ok) {
              const buf = await res.arrayBuffer()
              setCheckerInput({
                userInput: opportunityText,
                attachment: {
                  mimeType: primary.contentType ?? 'application/octet-stream',
                  dataBase64: arrayBufferToBase64(buf),
                  fileName: primary.fileName ?? undefined,
                },
              })
              return
            }
          } catch {
            // fall through to text-only check
          }
        }
        setCheckerInput({ userInput: opportunityText })
      })
      .catch(() => setError('Could not load this submission.'))
      .finally(() => setLoading(false))
  }, [id])

  if (!id) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        No submission ID provided.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <SurfaceCard className="p-5">
              <Skeleton className="h-4 w-32" />
              <div className="mt-4 space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5">
            <Skeleton className="h-24 w-full" />
          </SurfaceCard>
        </div>
      </div>
    )
  }

  if (error || !opportunity) {
    return (
      <div className="space-y-4">
        <Link
          href="/student/opportunities"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Opportunities
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? 'Submission not found.'}
        </div>
      </div>
    )
  }

  const shortId = opportunity.id.slice(0, 8).toUpperCase()

  return (
    <div className="space-y-6">
      <Link
        href="/student/opportunities"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Opportunities
      </Link>

      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
          Self-Sourced Submission
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{opportunity.jobTitle}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{opportunity.employerName}</p>
      </div>

      <ReviewProgressBar status={opportunity.status} />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
              <Building2 className="h-3.5 w-3.5 text-gray-400" />
              {opportunity.employerName}
            </span>
            {opportunity.workMode && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600 capitalize">
                <Monitor className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.workMode}
              </span>
            )}
            {opportunity.location && (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-600">
                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                {opportunity.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600">
              <Star className="h-3.5 w-3.5" />
              Self-sourced
            </span>
          </div>

          {/* Description */}
          <SurfaceCard className="p-5">
            <div className="mb-4 flex items-center gap-2 border-b border-gray-100 pb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                <FileText className="h-3.5 w-3.5 text-red-500" />
              </div>
              <p className="text-sm font-semibold text-gray-900">Position Description</p>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-gray-700">
              {opportunity.descriptionText}
            </p>
          </SurfaceCard>

          {/* Submission details */}
          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
              <p className="text-xs font-semibold text-gray-500">Submission details</p>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
                ID: {shortId}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 p-5">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Submitted
                </p>
                <p className="mt-1 text-sm text-gray-700">{formatDate(opportunity.createdAt)}</p>
              </div>
              {opportunity.sourceUrl && (
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                    Source URL
                  </p>
                  <a
                    href={opportunity.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm text-red-600 hover:underline"
                  >
                    View link <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </SurfaceCard>

          {/* Attachments */}
          {opportunity.attachments.length > 0 && (
            <SurfaceCard className="p-5">
              <div className="mb-3 flex items-center gap-2 border-b border-gray-100 pb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50">
                  <Paperclip className="h-3.5 w-3.5 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-gray-900">Attachments</p>
              </div>
              <ul className="space-y-2">
                {opportunity.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <Paperclip className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    {a.fileName ?? 'Attachment'}
                  </li>
                ))}
              </ul>
            </SurfaceCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {(jobCheck.isLoading || jobCheck.result || jobCheck.error) && (
            <SurfaceCard className="p-4">
              <CheckerResultPanel
                result={jobCheck.result}
                isLoading={jobCheck.isLoading}
                error={jobCheck.error}
                feature="job-checker"
              />
            </SurfaceCard>
          )}
          <ReviewStatusCard opportunity={opportunity} />

          <SurfaceCard className="space-y-2 p-5">
            {opportunity.status === 'published' && (
              <Link
                href={`/student/opportunities/view?id=${opportunity.id}`}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >
                <CheckCircle2 className="h-4 w-4" />
                Apply Now
              </Link>
            )}
            <Link
              href="/student/opportunities"
              className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Back to Opportunities
            </Link>
            {opportunity.status === 'rejected' && (
              <Link
                href="/student/self-sourced-internships"
                className="flex w-full items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Submit Another
              </Link>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  )
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0)
  }
  return btoa(binary)
}

export default function OpportunityReviewPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-72" />
        </div>
      }
    >
      <OpportunityReviewContent />
    </Suspense>
  )
}
