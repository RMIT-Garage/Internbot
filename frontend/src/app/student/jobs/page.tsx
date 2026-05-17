import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/student/Premium'
import { JobsList } from './JobsList'

export default function CoordinatorJobsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Approval Queue"
        title="Self-Sourced Job Approvals"
        description="Triage student-submitted roles with AI advisory previews, workplace risk signals, and review actions."
      />
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading jobs...</div>}>
        <JobsList />
      </Suspense>
    </div>
  )
}
