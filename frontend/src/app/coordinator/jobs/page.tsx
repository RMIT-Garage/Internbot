import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import { JobsList } from './JobsList'

export default function CoordinatorJobsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Phase 2: Post-Offer Administration"
        title="Placement Processing"
        description="Formal university processing for confirmed placements with submitted contracts and placement documents."
      />
      <Suspense
        fallback={<div className="text-sm text-zinc-500">Loading placement processing...</div>}
      >
        <JobsList />
      </Suspense>
    </div>
  )
}
