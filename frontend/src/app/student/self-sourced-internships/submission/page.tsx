'use client'

import Link from 'next/link'

export default function SubmissionSuccessPage() {
  return (
    <main className="flex-1 overflow-y-auto bg-slate-50 p-10">
      {/* HERO */}
      <section className="mx-auto mb-10 max-w-7xl">
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200">
            ✓
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.25em] uppercase">
              <span className="text-slate-400">Applications</span>
              <span className="text-slate-300">/</span>
              <span className="text-rose-700">Submission Complete</span>
            </div>

            <h1 className="text-5xl font-black tracking-tight text-slate-900">
              Submission Successful
            </h1>

            <p className="max-w-3xl text-[15px] leading-relaxed text-slate-500">
              Your internship application for{' '}
              <span className="font-semibold text-slate-900">Alex Chen (s3829104)</span> has been
              received and entered into the coordinator review workflow.
            </p>
          </div>
        </div>
      </section>

      {/* MAIN GRID */}
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-start gap-10">
        {/* LEFT COLUMN */}
        <div className="col-span-7 space-y-8">
          {/* SUBMISSION DETAILS */}
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-600 via-red-500 to-orange-400" />

            <div className="p-8">
              <div className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-rose-700 uppercase">
                Submission ID • RMIT-2024-8842
              </div>

              <div className="mt-8 grid grid-cols-2 gap-y-10">
                {/* employer */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                    Employer
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-black text-yellow-400">
                      A
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Atlassian</h3>

                      <p className="text-xs text-slate-500">Enterprise Partner</p>
                    </div>
                  </div>
                </div>

                {/* role */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                    Role
                  </p>

                  <h3 className="text-lg font-bold text-slate-900">UX Design Intern</h3>

                  <p className="mt-1 text-xs text-slate-500">Design Industry Practicum</p>
                </div>

                {/* source */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                    Source Type
                  </p>

                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                    👤 Self-Sourced
                  </div>
                </div>

                {/* date */}
                <div>
                  <p className="mb-3 text-[10px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                    Date Filed
                  </p>

                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                    📅 Oct 25, 2024
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* NEXT STEPS */}
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                →
              </div>

              <div>
                <h2 className="text-2xl font-bold text-slate-900">Next Steps</h2>

                <p className="text-sm text-slate-500">Track your internship approval process.</p>
              </div>
            </div>

            <div className="space-y-10">
              {/* STEP 1 */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full bg-rose-600 text-xs font-bold text-white shadow">
                    ✓
                  </div>

                  <div className="mt-2 w-[2px] flex-1 bg-rose-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-900">Submission Received</h4>

                    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-emerald-700 uppercase">
                      Completed
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Your documents and employer details were successfully submitted.
                  </p>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-600 bg-white">
                    <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-blue-600" />
                  </div>

                  <div className="mt-2 w-[2px] flex-1 bg-slate-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-900">AI Advisor Scan</h4>

                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-blue-700 uppercase">
                      In Progress
                    </span>
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Automated suitability analysis and compliance verification is currently running.
                  </p>
                </div>
              </div>

              {/* STEP 3 */}
              <div className="relative flex gap-5">
                <div className="relative flex flex-col items-center">
                  <div className="h-7 w-7 rounded-full bg-slate-200" />

                  <div className="mt-2 w-[2px] flex-1 bg-slate-200" />
                </div>

                <div className="pb-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-bold text-slate-400">Coordinator Review</h4>

                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                      Pending
                    </span>
                  </div>

                  <p className="mt-2 text-sm text-slate-400">
                    Manual verification by internship coordinators.
                  </p>
                </div>
              </div>

              {/* STEP 4 */}
              <div className="relative flex gap-5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />

                <div>
                  <h4 className="font-bold text-slate-400">Final Decision</h4>

                  <p className="mt-2 text-sm text-slate-400">
                    Approval outcome will be delivered via email notification.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="col-span-5 space-y-7">
          {/* ADVISOR NOTE */}
          <section className="relative overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-cyan-50 p-7 shadow-sm">
            <div className="absolute top-0 left-0 h-full w-1 bg-blue-500" />

            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow">
                ✦
              </div>

              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-blue-600 uppercase">
                  Academic Advisor
                </p>

                <h3 className="font-bold text-slate-900">AI Recommendation</h3>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-blue-900/80">
              Your application aligns strongly with Design Industry Practicum requirements.
              Atlassian has been identified as a high-confidence employer partner.
            </p>
          </section>

          {/* ACTIONS */}
          <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
            <Link
              href="/student/dashboard"
              className="flex w-full items-center justify-center rounded-2xl bg-rose-600 py-4 text-sm font-bold text-white shadow-lg shadow-rose-100 transition hover:bg-rose-700 active:scale-[0.99]"
            >
              Return to Dashboard
            </Link>

            <Link
              href="/student/applications"
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 py-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
            >
              View My Applications
            </Link>

            <div className="mt-6 border-t border-slate-100 pt-6 text-center">
              <p className="text-xs text-slate-400">
                Need help?{' '}
                <span className="cursor-pointer font-semibold text-slate-600 hover:text-slate-900">
                  Contact Support
                </span>
              </p>
            </div>
          </section>

          {/* STAT CARD */}
          <section className="relative min-h-[260px] overflow-hidden rounded-3xl bg-emerald-900 shadow-xl">
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-white/5 blur-2xl" />

            <div className="relative z-10 flex h-full flex-col justify-end p-8">
              <span className="text-[10px] font-bold tracking-[0.25em] text-emerald-200 uppercase">
                Student Success
              </span>

              <h3 className="mt-4 text-3xl leading-tight font-black text-white">94%</h3>

              <p className="mt-2 text-sm leading-relaxed text-emerald-50/80">
                of RMIT students secured internships within 2 weeks of submission.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
