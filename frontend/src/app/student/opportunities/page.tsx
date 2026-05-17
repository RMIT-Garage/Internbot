'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart3, BriefcaseBusiness, Sparkles } from 'lucide-react'

import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/student/Premium'

import { StatusBadge, type CoordinatorStatus } from '@/components/student/StatusBadge'
import { OpportunitiesService, InternshipsService } from '@/lib/api/openapi-client'
import type { OpportunityResponse, InternshipListItemResponse } from '@/lib/api/openapi-client'

function opportunityStatusToBadge(status: string): CoordinatorStatus {
  const map: Record<string, CoordinatorStatus> = {
    published: 'active',
    draft: 'pending',
    pending_verification: 'on_track',
    rejected: 'rejected',
    archived: 'archived',
  }
  return map[status] ?? 'pending'
}

export default function StudentOpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<OpportunityResponse[]>([])
  const [internships, setInternships] = useState<InternshipListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [oppRes, intRes] = await Promise.all([
          OpportunitiesService.listOpportunities(),
          InternshipsService.listInternships(),
        ])
        setOpportunities(oppRes.items)
        setInternships(intRes.items)
      } catch (err: any) {
        setError(err.message || 'Failed to load opportunities')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const appliedOpportunityIds = new Set(internships.map((i) => i.opportunityId))
  const activeCount = opportunities.filter((o) => o.status === 'published').length
  const appliedCount = internships.length

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Opportunities"
        title="Available Internships"
        description="Browse and apply to internship opportunities available in your semester."
      />

      {/* KPI ROW */}
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active roles"
          value={activeCount}
          detail="Published opportunities"
          icon={BriefcaseBusiness}
          tone="green"
          progress={
            opportunities.length > 0 ? Math.round((activeCount / opportunities.length) * 100) : 0
          }
        />
        <KPIStatCard
          title="My applications"
          value={appliedCount}
          detail="Submitted applications"
          icon={BarChart3}
          tone="blue"
          progress={
            activeCount > 0 ? Math.min(Math.round((appliedCount / activeCount) * 100), 100) : 0
          }
        />
        <KPIStatCard
          title="Total available"
          value={opportunities.length}
          detail="Opportunities this semester"
          icon={Sparkles}
          tone="purple"
          progress={100}
        />
      </div>

      <AIInsightCard
        title="Opportunity Insights"
        confidence={84}
        insight="Browse published opportunities and apply early to improve your acceptance chances."
      />

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Loading opportunities...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {!loading && opportunities.length === 0 && !error && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
          No opportunities available for your semester yet.
        </div>
      )}

      {/* OPPORTUNITY GRID */}
      <div className="grid gap-4 lg:grid-cols-3">
        {opportunities.map((opportunity) => {
          const alreadyApplied = appliedOpportunityIds.has(opportunity.id)

          return (
            <SurfaceCard
              key={opportunity.id}
              className="flex flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-950">{opportunity.jobTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{opportunity.employerName}</p>
                </div>
                <StatusBadge status={opportunityStatusToBadge(opportunity.status)} />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-2xl font-bold text-slate-950">
                    {opportunity.applicationCount}
                  </p>
                  <p className="text-xs text-slate-500">Applications</p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-bold text-slate-950 capitalize">
                    {opportunity.type.replace('_', ' ')}
                  </p>
                  <p className="text-xs text-slate-500">Type</p>
                </div>
              </div>

              {opportunity.workMode && (
                <p className="mt-3 text-xs text-slate-400 capitalize">
                  {opportunity.workMode}
                  {opportunity.location ? ` · ${opportunity.location}` : ''}
                </p>
              )}

              <div className="mt-auto pt-4">
                {alreadyApplied ? (
                  <span className="block w-full rounded-xl bg-slate-100 py-2 text-center text-sm font-semibold text-slate-500">
                    Applied
                  </span>
                ) : opportunity.status === 'published' ? (
                  <Link
                    href={`/student/jobs/${opportunity.id}`}
                    className="block w-full rounded-xl bg-red-600 py-2 text-center text-sm font-bold text-white hover:bg-red-700"
                  >
                    Apply
                  </Link>
                ) : (
                  <span className="block w-full rounded-xl bg-slate-100 py-2 text-center text-sm font-semibold text-slate-400">
                    Not available
                  </span>
                )}
              </div>
            </SurfaceCard>
          )
        })}
      </div>
    </div>
  )
}
