'use client'

import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { semesterInventory } from '@/lib/coordinator/mockData'
import { useCoordinatorApiResource } from '@/hooks/useCoordinatorApiResource'
import { listSemesters } from '@/lib/coordinator/api'
import { mapSemesterToInventory } from '@/lib/coordinator/apiMappers'

export default function CoordinatorSemestersPage() {
  const {
    data: semesters,
    loading,
    error,
    source,
  } = useCoordinatorApiResource(
    async () => {
      if (process.env.NODE_ENV === 'development') {
        console.debug(
          '[coordinator/semesters] backend filters: limit only; display filters are client-side'
        )
      }
      const response = await listSemesters({ limit: 100 })
      return response.items.map(mapSemesterToInventory)
    },
    semesterInventory,
    'semesters',
    { emptyData: [] }
  )

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Semester Management"
        title="Semester Operations"
        description="Manage intake windows, lifecycle phases, cohort enrollment, and approval workload across academic periods."
        actions={
          <PendingActionButton
            message="Create semester API integration pending."
            className="border-red-700 bg-red-700 text-white hover:bg-red-800"
          >
            <Plus className="h-4 w-4" />
            Create New Semester
          </PendingActionButton>
        }
      />
      <div className="grid gap-4 md:grid-cols-3">
        <KPIStatCard
          title="Active cohorts"
          value="3"
          detail="Across 2026 intake windows"
          icon={CalendarDays}
          tone="blue"
          progress={72}
        />
        <KPIStatCard
          title="Enrolled students"
          value="261"
          detail="Total semester participation"
          icon={Plus}
          tone="green"
          progress={81}
        />
        <KPIStatCard
          title="AI recommendations"
          value="7"
          detail="Setup and workload signals"
          icon={Sparkles}
          tone="purple"
          progress={46}
        />
      </div>
      <AIInsightCard
        title={`AI Recommendations (${source === 'api' ? 'API-backed semesters' : 'fallback semesters'})`}
        confidence={87}
        insight="Semester 2 should open coordinator review capacity one week earlier based on current contract turnaround and projected application volume."
      />
      {(loading || error) && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {loading
            ? 'Loading semesters from the workflow API...'
            : `Using isolated fallback data: ${error}`}
        </div>
      )}
      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Semester Inventory</h2>
          <p className="text-sm text-slate-500">
            Lifecycle status, enrollment windows, and flagged workload.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold tracking-wide text-slate-500 uppercase">
              <tr>
                {[
                  'Semester',
                  'Lifecycle',
                  'Enrollment Window',
                  'Students',
                  'Current Phase',
                  'Flags',
                ].map((head) => (
                  <th key={head} className="px-5 py-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {semesters.map((semester) => (
                <tr key={semester.name} className="hover:bg-slate-50">
                  <td className="px-5 py-4 font-bold text-slate-950">{semester.name}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={semester.status as 'active' | 'pending' | 'archived'} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{semester.window}</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{semester.students}</td>
                  <td className="px-5 py-4 text-slate-600">{semester.phase}</td>
                  <td className="px-5 py-4 font-bold text-red-700">{semester.flagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
      <div className="grid gap-4 md:grid-cols-3">
        {semesters.map((semester) => (
          <SurfaceCard key={semester.name} className="p-5">
            <CalendarDays className="h-5 w-5 text-red-700" />
            <h2 className="mt-4 font-bold text-slate-950">{semester.name}</h2>
            <p className="mt-2 text-sm text-slate-500">{semester.phase}</p>
          </SurfaceCard>
        ))}
      </div>
    </div>
  )
}
