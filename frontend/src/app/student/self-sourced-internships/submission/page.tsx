'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

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
    return <div className="p-10 text-gray-500">Loading submission details...</div>
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
    <main className="flex-1 overflow-y-auto bg-gray-50 p-10">
      {/* HERO */}
      <section className="mx-auto mb-10 max-w-7xl">
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white shadow-lg shadow-red-200">
            ✓
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] uppercase">
              <span className="text-gray-400">Internships</span>
              <span className="text-gray-300">/</span>
              <span className="text-red-700">Submission Complete</span>
            </div>

            <h1 className="text-5xl font-black tracking-tight text-black">Submission Successful</h1>

            <p className="max-w-3xl text-[15px] leading-relaxed text-gray-500">
              Your self-sourced internship submission for{' '}
              <span className="font-semibold text-black">{studentLabel}</span> has been received and
              is pending coordinator verification.
            </p>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-start gap-10">
        {/* LEFT COLUMN */}
        <div className="col-span-7 space-y-8">
          {/* SUBMISSION DETAILS */}
          <section className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-red-600" />

            <div className="p-8">
              <div className="inline-flex items-center rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-red-700 uppercase">
                Submission ID • {shortId}
              </div>

              <div className="mt-8 grid grid-cols-2 gap-y-10">
                {/* employer */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase">
                    Employer
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black font-black text-white">
                      {employerName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-black">{employerName}</h3>
                      <p className="text-xs text-gray-500">Self-Sourced</p>
                    </div>
                  </div>
                </div>

                {/* role */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase">
                    Role
                  </p>

                  <h3 className="text-lg font-bold text-black">{jobTitle}</h3>
                  <p className="mt-1 text-xs text-gray-500">Custom Submission</p>
                </div>

                {/* source */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase">
                    Source Type
                  </p>

                  <div className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700">
                    Self-Sourced
                  </div>
                </div>

                {/* date */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-gray-400 uppercase">
                    Date Filed
                  </p>

                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                    {dateFiled}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* NEXT STEPS */}
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white">
                →
              </div>

              <div>
                <h2 className="text-2xl font-bold text-black">Next Steps</h2>
                <p className="text-sm text-gray-500">Track your internship approval process.</p>
              </div>
            </div>

            <div className="space-y-10">
              {/* STEP 1 — done */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white shadow">
                    ✓
                  </div>
                  <div className="mt-2 w-[2px] flex-1 bg-red-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-black">Submission Received</h4>
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-red-700 uppercase">
                      Completed
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-500">
                    Your employer and role details have been submitted successfully.
                  </p>
                </div>
              </div>

              {/* STEP 2 — in progress */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-white">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-black" />
                  </div>
                  <div className="mt-2 w-[2px] flex-1 bg-gray-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-black">Coordinator Verification</h4>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-black uppercase">
                      In Progress
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500">
                    A coordinator will review your submission and verify the opportunity.
                  </p>
                </div>
              </div>

              {/* STEP 3 — pending */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full bg-gray-200" />
                  <div className="mt-2 w-[2px] flex-1 bg-gray-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-gray-400">Apply to Opportunity</h4>
                    <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-gray-500 uppercase">
                      Pending
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400">
                    Once published, the opportunity will appear under Opportunities and you can
                    apply.
                  </p>
                </div>
              </div>

              {/* STEP 4 — pending */}
              <div className="relative flex gap-5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-gray-200" />

                <div>
                  <h4 className="font-bold text-gray-400">Offer Review</h4>
                  <p className="mt-2 text-sm text-gray-400">
                    Upload your offer letter for coordinator approval after applying.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-5 space-y-7">
          {/* STATUS CARD */}
          <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gray-50 p-7 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1 bg-red-600" />

            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow">
                ✦
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-red-600 uppercase">
                  Current Status
                </p>
                <h3 className="font-bold text-black">Pending Verification</h3>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-black/70">
              Your submission is in the coordinator review queue. You will be notified when it is
              approved or if changes are needed.
            </p>
          </section>

          {/* ACTIONS */}
          <section className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <Link
              href="/student/dashboard"
              className="flex w-full items-center justify-center rounded-2xl bg-red-600 py-4 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-red-700 active:scale-[0.99]"
            >
              Return to Dashboard
            </Link>

            <Link
              href="/student/self-sourced-internships"
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-gray-200 bg-gray-50 py-4 text-sm font-bold text-gray-700 transition hover:bg-gray-100"
            >
              Submit Another Internship
            </Link>

            <div className="mt-6 border-t border-gray-100 pt-6 text-center">
              <p className="text-xs text-gray-400">
                Need help?{' '}
                <Link
                  href="/student/notifications"
                  className="font-semibold text-gray-600 hover:text-black"
                >
                  Check Notifications
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

export default function SubmissionSuccessPage() {
  return (
    <Suspense fallback={<div className="p-10 text-gray-500">Loading submission details...</div>}>
      <SubmissionContent />
    </Suspense>
  )
}
