'use client'

import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import type { InternshipListItemResponse } from '@/types/api'
import type { SemesterResponse } from '@/types/api'
import { formatSemesterLabel } from '@/lib/semester/display'

interface PlacementConfirmedBannerProps {
  internship: InternshipListItemResponse
  semester?: SemesterResponse | null
}

export function PlacementConfirmedBanner({ internship, semester }: PlacementConfirmedBannerProps) {
  const semesterLabel = semester
    ? formatSemesterLabel(semester)
    : internship.semesterDisplayName || 'your selected semester'

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-900">Enrolled for this semester</p>
          <p className="mt-1 text-sm leading-6 text-emerald-800">
            Your placement is confirmed — you are enrolled in the internship course for{' '}
            <span className="font-semibold">{semesterLabel}</span>. You will complete your credit
            with{' '}
            <span className="font-semibold">{internship.opportunityJobTitle}</span> at{' '}
            <span className="font-semibold">{internship.opportunityEmployerName}</span>.
          </p>
          <Link
            href={`/student/applications/view?id=${internship.id}`}
            className="mt-2 inline-flex text-xs font-bold text-emerald-900 underline underline-offset-2 hover:text-emerald-950"
          >
            View approved application
          </Link>
        </div>
      </div>
    </div>
  )
}
