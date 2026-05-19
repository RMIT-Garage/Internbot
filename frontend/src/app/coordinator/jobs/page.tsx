import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import { JobsList } from './JobsList'

export default function CoordinatorJobsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Approval Queue"
        title="Placement Reviews"
        description="Triage student-submitted placements with AI insights, workplace risk signals, and review actions."
      />
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading jobs...</div>}>
        <JobsList />
      </Suspense>
    </div>
  )
}
