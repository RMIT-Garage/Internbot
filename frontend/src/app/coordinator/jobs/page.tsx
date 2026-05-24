import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { JobsList } from './JobsList'

export default function CoordinatorJobsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Post-Offer Administration"
        title="Placement Processing"
        description="Formal university processing for confirmed placements with submitted contracts and placement documents."
      />
      <Suspense fallback={<CoordinatorContentSkeleton title="Loading placement processing..." />}>
        <JobsList />
      </Suspense>
    </div>
  )
}
