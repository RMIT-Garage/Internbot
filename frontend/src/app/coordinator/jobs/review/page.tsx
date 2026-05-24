import { Suspense } from 'react'
import { JobReviewClient } from './JobReviewClient'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'

export default function CoordinatorJobReviewPage() {
  return (
    <Suspense fallback={<CoordinatorContentSkeleton title="Loading job review…" />}>
      <JobReviewClient />
    </Suspense>
  )
}
