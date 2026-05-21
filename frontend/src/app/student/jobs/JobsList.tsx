'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { InternshipsService } from '@/lib/api/openapi-client'
import type { InternshipListItemResponse } from '@/lib/api/openapi-client'
import { StatusBadge, type CoordinatorStatus } from '@/components/student/StatusBadge'
import { formatDate } from '@/lib/utils'

const INTERNSHIP_STATUS_TO_BADGE: Record<InternshipListItemResponse['status'], CoordinatorStatus> =
  {
    applied: 'pending',
    offer_pending_review: 'on_track',
    offer_changes_requested: 'changes_requested',
    offer_approved: 'approved',
    rejected: 'rejected',
  }

function internshipStatusToBadge(status: InternshipListItemResponse['status']): CoordinatorStatus {
  return INTERNSHIP_STATUS_TO_BADGE[status]
}

export function JobsList() {
  const { user } = useAuth()
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let active = true

    const load = async () => {
      try {
        setLoading(true)
        const res = await InternshipsService.listInternships(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          '-createdAt'
        )
        if (active) setInternships(res.items)
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load applications')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [user])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        Loading your applications...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
        {error}
      </div>
    )
  }

  if (internships.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
        You have not submitted any applications yet.{' '}
        <Link href="/student/opportunities" className="font-semibold text-red-600 hover:underline">
          Browse opportunities
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
            <th className="px-4 py-3">Role</th>
            <th className="px-4 py-3">Employer</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Submitted</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {internships.map((internship) => (
            <tr key={internship.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">
                {internship.opportunityJobTitle}
              </td>
              <td className="px-4 py-3 text-slate-600">{internship.opportunityEmployerName}</td>
              <td className="px-4 py-3 text-slate-500 capitalize">
                {internship.opportunityType.replace('_', ' ')}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(internship.lastSubmittedAt ?? internship.createdAt)}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={internshipStatusToBadge(internship.status)} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/student/jobs/${internship.id}`}
                  className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  View
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
