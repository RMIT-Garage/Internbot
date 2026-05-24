'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'

import { SurfaceCard } from '@/components/student/Premium'
import { Skeleton } from '@/components/ui/ContentSkeleton'
import { OpportunitiesService, UsersService } from '@/lib/api/openapi-client'
import type { OpportunityResponse, StudentUserResponse } from '@/lib/api/openapi-client'

function SubmissionContent() {
  const params = useSearchParams()
  const id = params.get('id')

  const [opportunity, setOpportunity] = useState<OpportunityResponse | null>(null)
  const [student, setStudent] = useState<StudentUserResponse | null>(null)
  const [loading, setLoading] = useState(!!id)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const [opp, user] = await Promise.all([
          OpportunitiesService.getOpportunity(id),
          UsersService.getMyProfile(),
        ])
        setOpportunity(opp)
        if (user.role === 'student') setStudent(user)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <SurfaceCard className="p-5">
              <Skeleton className="h-4 w-32" />
              <div className="mt-4 grid grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
          <SurfaceCard className="p-5">
            <Skeleton className="h-4 w-24" />
          </SurfaceCard>
        </div>
      </div>
    )
  }

  const studentLabel = student
    ? `${student.displayName ?? 'Student'} (${student.studentProfile.studentNumber})`
    : 'Your account'
  const employerName = opportunity?.employerName ?? '—'
  const jobTitle = opportunity?.jobTitle ?? '—'
  const dateFiled = opportunity
    ? new Date(opportunity.createdAt).toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '—'
  const shortId = opportunity ? opportunity.id.slice(0, 8).toUpperCase() : '—'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
            Self-Sourced Internship
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-gray-900">Submission Successful</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your submission for <span className="font-semibold text-gray-700">{studentLabel}</span>{' '}
            is pending coordinator verification.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Details */}
        <div className="space-y-4">
          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-5 py-3">
              <p className="text-xs font-semibold text-gray-500">Submission details</p>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-600">
                ID: {shortId}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 p-5">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Employer
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{employerName}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Role
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{jobTitle}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Type
                </p>
                <span className="mt-1 inline-flex rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  Self-sourced
                </span>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-gray-400 uppercase">
                  Date filed
                </p>
                <p className="mt-1 text-sm text-gray-700">{dateFiled}</p>
              </div>
            </div>
          </SurfaceCard>

          {/* Next steps */}
          <SurfaceCard className="p-5">
            <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
              Review Process
            </p>
            <h4 className="mt-1 text-sm font-bold text-gray-900">What happens next?</h4>
            <ol className="mt-4 space-y-0">
              {[
                'Your submission is sent to a coordinator for verification.',
                'Once approved, the opportunity becomes available in your semester.',
                'You can then apply and upload your offer letter.',
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-red-600">
                      {i + 1}
                    </span>
                    {i < 2 && <div className="my-1 h-6 w-px bg-gray-200" />}
                  </div>
                  <p className="pt-0.5 pb-4 text-xs leading-relaxed text-gray-500">{text}</p>
                </li>
              ))}
            </ol>
          </SurfaceCard>
        </div>

        {/* Sidebar actions */}
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            <div className="mb-3 rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-bold tracking-wide text-gray-500 uppercase">Status</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">Pending Verification</p>
              <p className="mt-1 text-xs text-gray-400">
                You will be notified when the coordinator reviews your submission.
              </p>
            </div>

            <div className="space-y-2">
              <Link
                href="/student/dashboard"
                className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700"
              >
                Return to Dashboard
              </Link>
              <Link
                href="/student/self-sourced-internships"
                className="flex w-full items-center justify-center rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Submit Another
              </Link>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  )
}

export default function SubmissionSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      }
    >
      <SubmissionContent />
    </Suspense>
  )
}
