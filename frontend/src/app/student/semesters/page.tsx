'use client'

import { CalendarDays, Plus, Sparkles } from 'lucide-react'
import {
  AIInsightCard,
  CoordinatorPageHeader,
  KPIStatCard,
  SurfaceCard,
} from '@/components/coordinator/Premium'
import { StatusBadge } from '@/components/coordinator/StatusBadge'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'

import { DashboardShell } from '@/components/layout/DashboardShell'

export default function StudentDashboardPage() {
  // 🔁 renamed data (same structure, different meaning)
  const courses = [
    {
      name: 'Software Engineering',
      status: 'active',
      window: 'Semester 1',
      students: 0, // not relevant but preserved shape
      phase: 'In Progress',
      flagged: 0,
    },
    {
      name: 'Data Structures',
      status: 'active',
      window: 'Semester 1',
      students: 0,
      phase: 'Ongoing',
      flagged: 0,
    },
  ]

  const loading = false
  const error = null
  const source = 'fallback'

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* HEADER (same component, renamed content) */}
        <CoordinatorPageHeader
          eyebrow="Student Dashboard"
          title="My Learning Overview"
          description="Track your courses, progress, deadlines, and academic activity."
          actions={
            <PendingActionButton
              message="Course enrollment actions not enabled yet."
              className="border-red-700 bg-red-700 text-white hover:bg-red-800"
            >
              <Plus className="h-4 w-4" />
              Browse Courses
            </PendingActionButton>
          }
        />

        {/* KPI SECTION (same layout, student meaning) */}
        <div className="grid gap-4 md:grid-cols-3">
          <KPIStatCard
            title="Enrolled Courses"
            value="4"
            detail="Active subjects this semester"
            icon={CalendarDays}
            tone="blue"
            progress={72}
          />

          <KPIStatCard
            title="Upcoming Deadlines"
            value="3"
            detail="Assignments due soon"
            icon={Plus}
            tone="green"
            progress={81}
          />

          <KPIStatCard
            title="Study Insights"
            value="7"
            detail="AI learning suggestions"
            icon={Sparkles}
            tone="purple"
            progress={46}
          />
        </div>

        {/* AI CARD (reframed, not coordinator ops anymore) */}
        <AIInsightCard
          title={`Learning Insights (${source === 'api' ? 'live data' : 'cached data'})`}
          confidence={87}
          insight="You perform best in structured problem-solving tasks. Consider revising Data Structures earlier in the week for better retention."
        />

        {/* TABLE (NOW = COURSES instead of semesters) */}
        <SurfaceCard className="overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">My Courses</h2>
            <p className="text-sm text-slate-500">
              Current subjects and learning progress overview.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-bold text-slate-500 uppercase">
                <tr>
                  {['Course', 'Status', 'Semester', 'Progress', 'Current Module', 'Alerts'].map(
                    (head) => (
                      <th key={head} className="px-5 py-3">
                        {head}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.name} className="hover:bg-slate-50">
                    <td className="px-5 py-4 font-bold text-slate-950">{course.name}</td>

                    <td className="px-5 py-4">
                      <StatusBadge status={course.status as 'active' | 'pending' | 'archived'} />
                    </td>

                    <td className="px-5 py-4 text-slate-600">{course.window}</td>

                    <td className="px-5 py-4 font-semibold text-slate-900">68%</td>

                    <td className="px-5 py-4 text-slate-600">Week 4: Algorithms</td>

                    <td className="px-5 py-4 font-bold text-red-700">{course.flagged}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        {/* LOWER CARDS (now study focus instead of semester cards) */}
        <div className="grid gap-4 md:grid-cols-3">
          {courses.map((course) => (
            <SurfaceCard key={course.name} className="p-5">
              <CalendarDays className="h-5 w-5 text-red-700" />
              <h2 className="mt-4 font-bold text-slate-950">{course.name}</h2>
              <p className="mt-2 text-sm text-slate-500">Current focus: {course.phase}</p>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </DashboardShell>
  )
}
