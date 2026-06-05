'use client'

import Link from 'next/link'
import { AlertCircle, Info } from 'lucide-react'
import type { SemesterEnrolmentState } from '@/api/models/SemesterEnrolmentState'
import type { InternshipListItemResponse, SemesterResponse } from '@/lib/api/openapi-client'
import {
  deriveSemesterEnrollmentBanner,
  type SemesterEnrollmentBannerTone,
} from '@/lib/student/semesterEnrollmentBanner'

interface SemesterEnrollmentBannerProps {
  semester: SemesterResponse | null
  semesterEnrolmentState?: SemesterEnrolmentState | string | null
  internships: readonly InternshipListItemResponse[]
  semesterId?: string | null
  openSemesterCount?: number
}

const toneClasses: Record<SemesterEnrollmentBannerTone, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-950',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
}

export function SemesterEnrollmentBanner(props: SemesterEnrollmentBannerProps) {
  const content = deriveSemesterEnrollmentBanner({
    semester: props.semester,
    semesterEnrolmentState: props.semesterEnrolmentState,
    internships: props.internships,
    semesterId: props.semesterId,
    openSemesterCount: props.openSemesterCount,
  })

  if (!content.show) return null

  const Icon = content.tone === 'info' ? Info : AlertCircle

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[content.tone]}`}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{content.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-90">{content.body}</p>
          {content.primaryAction && (
            <Link
              href={content.primaryAction.href}
              className="mt-3 inline-flex text-sm font-bold underline underline-offset-2"
            >
              {content.primaryAction.label}
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
