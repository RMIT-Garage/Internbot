'use client'

import { BarChart3, BriefcaseBusiness, Plus, Sparkles } from 'lucide-react'
import { PendingActionButton } from '@/components/student/PendingActionButton'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/student/Premium'
import { StatusBadge } from '@/components/student/StatusBadge'
import { opportunities } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { listOpportunities } from '@/lib/coordinator/api'
import { formatDate } from '@/lib/utils'

export default function CoordinatorOpportunitiesPage() {
  const {
    data: opportunityRows,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/opportunities] backend filters: limit only; opportunity cards derive display fields client-side'
        )
      }
      const response = await listOpportunities({ limit: 100 })
      return response.items.map((item) => ({
        id: item.id,
        title: item.jobTitle,
        company: item.employerName,
        status:
          item.status === 'published'
            ? 'active'
            : item.status === 'pending_verification' || item.status === 'draft'
              ? 'pending'
              : 'archived',
        applications: item.applicationCount,
        engagement:
          item.applicationCount > 10 ? 'High' : item.applicationCount > 3 ? 'Medium' : 'New',
        closingDate: item.updatedAt,
      }))
    },
    opportunities,
    'opportunities',
    { emptyData: [] }
  )

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Opportunities Management"
        title="Partner Opportunities"
        description="Manage employer opportunities, engagement metrics, application volume, and publication state."
        actions={
          <PendingActionButton
            message="Create opportunity API integration pending."
            className="border-red-700 bg-red-700 text-white hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            New opportunity
          </PendingActionButton>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active roles"
          value={2}
          detail="Visible to students"
          icon={BriefcaseBusiness}
          tone="green"
          progress={66}
        />
        <KPIStatCard
          title="Applications"
          value={37}
          detail="Across partner postings"
          icon={BarChart3}
          tone="blue"
          progress={58}
        />
        <KPIStatCard
          title="AI suggestions"
          value={5}
          detail="Recommended optimisations"
          icon={Sparkles}
          tone="purple"
          progress={42}
        />
      </div>
      <AIInsightCard
        title={`Opportunity AI Suggestions (${source === 'api' ? 'API-backed' : 'fallback data'})`}
        confidence={84}
        insight="Cyber security postings are drawing strong engagement. Consider publishing one additional remote-friendly analytics role for Semester 2 demand."
      />
      {(loading || error) && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {loading
            ? 'Loading opportunities from the workflow API...'
            : `Using isolated fallback data: ${error}`}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-3">
        {opportunityRows.map((opportunity) => (
          <SurfaceCard
            key={opportunity.id}
            className="p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{opportunity.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{opportunity.company}</p>
              </div>
              <StatusBadge status={opportunity.status as 'active' | 'pending' | 'archived'} />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-2xl font-bold text-slate-950">{opportunity.applications}</p>
                <p className="text-xs text-slate-500">Applications</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-950">{opportunity.engagement}</p>
                <p className="text-xs text-slate-500">Engagement</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-500">
              Closes {formatDate(opportunity.closingDate)}
            </p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  )
}
