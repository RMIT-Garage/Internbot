import { Suspense } from 'react'
import { JobReviewClient } from './JobReviewClient'

export default function CoordinatorJobReviewPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading job review...</div>}>
      <JobReviewClient />
    </Suspense>
  )
}
