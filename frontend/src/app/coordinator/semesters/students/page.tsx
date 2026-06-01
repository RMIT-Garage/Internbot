import { Suspense } from 'react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import SemesterStudentsClient from './SemesterStudentsClient'

export default function SemesterStudentsPage() {
  return (
    <Suspense fallback={<CoordinatorContentSkeleton title="Loading students…" />}>
      <SemesterStudentsClient />
    </Suspense>
  )
}
