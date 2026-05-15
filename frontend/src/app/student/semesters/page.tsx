'use client'

import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'
import { AIInsightCard, KPIStatCard, SurfaceCard } from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'

import { DashboardShell } from '@/components/layout/DashboardShell'
import { PageHeader } from '@/components/layout/PageHeader'

export default function CoordinatorSemestersPage() {
  const semesters = [
    {
      name: 'Semester 1',
      status: 'active',
      window: 'Feb - Jun',
      students: 120,
      phase: 'Ongoing',
      flagged: 2,
    },
    {
      name: 'Semester 2',
      status: 'pending',
      window: 'Jul - Nov',
      students: 0,
      phase: 'Planning',
      flagged: 0,
    },
  ]

  const loading = false
  const error = null
  const source = 'fallback'

  return (
    <DashboardShell>
      <div className="space-y-6">
        <PageHeader
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

        {/* KPI Cards */}
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
          title={`AI Recommendations (${source})`}
          confidence={87}
          insight="Semester 2 should open coordinator review capacity one week earlier based on current contract turnaround and projected application volume."
        />

        {/* Table */}
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Semester Inventory</h2>
            <p className="text-sm text-slate-500">
              Lifecycle status, enrollment windows, and flagged workload.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
                <tr>
                  {[
                    'Semester',
                    'Lifecycle',
                    'Enrollment Window',
                    'Students',
                    'Current Phase',
                    'Flags',
                  ].map((h) => (
                    <th key={h} className="px-5 py-3">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {semesters.map((s) => (
                  <tr key={s.name} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold">{s.name}</td>

                    <td className="px-5 py-4">
                      <StatusBadge status={s.status as 'active' | 'pending' | 'archived'} />
                    </td>

                    <td className="px-5 py-4 text-slate-600">{s.window}</td>
                    <td className="px-5 py-4 font-semibold">{s.students}</td>
                    <td className="px-5 py-4 text-slate-600">{s.phase}</td>
                    <td className="px-5 py-4 font-bold text-red-700">{s.flagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {semesters.map((s) => (
            <SurfaceCard key={s.name} className="p-5">
              <CalendarDays className="h-5 w-5 text-red-700" />
              <h2 className="mt-4 font-bold">{s.name}</h2>
              <p className="mt-2 text-sm text-slate-500">{s.phase}</p>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
