import { Suspense } from 'react'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { StudentProfileClient } from './StudentProfileClient'

export default function CoordinatorStudentViewPage() {
  return (
    <Suspense fallback={<CoordinatorContentSkeleton title="Loading student profile..." />}>
      <StudentProfileClient />
    </Suspense>
  )
}
