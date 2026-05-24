import { Suspense } from 'react'
import StudentOpportunitiesPage from './OpportunitiesClient'
import { CardGridSkeleton } from '@/components/ui/ContentSkeleton'

export default function StudentOpportunitiesRoute() {
  return (
    <Suspense fallback={<CardGridSkeleton label="Loading opportunities…" />}>
      <StudentOpportunitiesPage />
    </Suspense>
  )
}
