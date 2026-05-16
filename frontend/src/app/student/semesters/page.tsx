'use client'

import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import { PendingActionButton } from '@/components/student/PendingActionButton'
import { AIInsightCard, KPIStatCard, SurfaceCard } from '@/components/student/Premium'
import { StatusBadge } from '@/components/student/StatusBadge'
import { useEffect, useState } from 'react'
import { SemestersService } from '@/lib/api/openapi-client'

export default function studentSemestersPage() {
  const [semesters, setSemesters] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSemesters = async () => {
      try {
        setLoading(true)

        const res = await SemestersService.listSemesters()
        setSemesters(res.items ?? [])
      } catch (err: any) {
        setError(err.message || 'Failed to load semesters')
      } finally {
        setLoading(false)
      }
    }

    fetchSemesters()
  }, [])

  return (
    <div className="space-y-6">
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white p-10">
        <div className="mx-auto grid max-w-6xl grid-cols-12 gap-10">
          {/* LEFT CONTENT */}
          <div className="col-span-8 space-y-10">
            {/* Header */}
            <div className="space-y-4">
              <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold tracking-widest text-slate-500 uppercase shadow-sm">
                Eligibility Verified
              </span>

              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                Select Your Semester
              </h1>

              <p className="max-w-2xl leading-relaxed text-slate-500">
                Your academic profile has been verified. Choose a semester to begin your internship
                workflow and lock your placement timeline.
              </p>
            </div>

            {/* Advisory */}
            <div className="relative flex gap-4 overflow-hidden rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-100">
                <Sparkles className="h-5 w-5 text-blue-600" />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-900">
                  Teaching Period Recommendation
                </h4>
                <p className="text-sm text-slate-600">
                  Based on workload trends and application cycles, we recommend{' '}
                  <span className="font-semibold text-blue-600">Semester 1 2026</span>.
                </p>
              </div>
            </div>

            {/* SEMESTER GRID */}
            <div className="grid grid-cols-2 gap-6">
              {/* PRIMARY CARD */}
              <div className="group relative cursor-pointer overflow-hidden rounded-3xl border border-red-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-br from-red-50/60 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                <div className="relative flex items-start justify-between">
                  <span className="rounded-full bg-red-50 px-3 py-1 text-[10px] font-bold tracking-widest text-red-600 uppercase">
                    Recommended
                  </span>

                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-md">
                    ✓
                  </div>
                </div>

                <h3 className="mt-6 text-2xl font-bold text-slate-900">Semester 1 2026</h3>

                <p className="mt-2 text-sm text-slate-500">INTE2710 • Feb 15 – Mar 30</p>

                <div className="mt-6">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[75%] rounded-full bg-red-500" />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">75% capacity filled</p>
                </div>

                <p className="mt-6 text-[11px] font-medium text-red-500 opacity-0 transition group-hover:opacity-100">
                  Click to select this semester →
                </p>
              </div>

              {/* SECONDARY CARD */}
              <div className="group relative cursor-pointer rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg">
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold tracking-widest text-slate-500 uppercase">
                    Available
                  </span>

                  <div className="h-8 w-8 rounded-full border-2 border-slate-200 transition group-hover:border-slate-400" />
                </div>

                <h3 className="mt-6 text-2xl font-bold text-slate-900">Semester 2 2026</h3>

                <p className="mt-2 text-sm text-slate-500">INTE2710 • Jul 15 – Aug 30</p>

                <div className="mt-6">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full w-[12%] rounded-full bg-slate-300" />
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">12% capacity filled</p>
                </div>

                <p className="mt-6 text-[11px] text-slate-400 opacity-0 transition group-hover:opacity-100">
                  Click to select this semester →
                </p>
              </div>
            </div>

            {/* NOTE INPUT */}
            <div className="space-y-3">
              <h4 className="text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                Additional Note (optional)
              </h4>

              <div className="h-32 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition focus-within:ring-2 focus-within:ring-red-100">
                <textarea
                  className="h-full w-full resize-none text-sm text-slate-700 outline-none placeholder:text-slate-400"
                  placeholder="Add any preferences or timing constraints..."
                />
              </div>
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="col-span-4 space-y-6">
            {/* Summary */}
            <div className="sticky top-8 space-y-6 rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">Selection Summary</h3>

              <div className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Selected</span>
                  <span className="font-semibold text-slate-900">Semester 1 2026</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Credits</span>
                  <span className="font-semibold">24 CP</span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-green-600">Verified</span>
                </div>
              </div>

              <button className="w-full rounded-2xl bg-red-600 py-4 font-bold text-white shadow-md transition hover:bg-red-700 active:scale-[0.98]">
                Confirm & Continue
              </button>

              <p className="text-center text-[11px] leading-relaxed text-slate-400">
                This will lock your semester selection and proceed to internship setup.
              </p>
            </div>

            {/* Next Steps */}
            <div className="mt-12 rounded-3xl border border-indigo-100 bg-indigo-50 p-6 shadow-sm">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-600">
                <Sparkles className="h-4 w-4" />
                Next Steps
              </div>

              <p className="text-xs leading-relaxed text-indigo-700/70">
                After confirmation, you’ll unlock internship application submission and supervisor
                allocation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
