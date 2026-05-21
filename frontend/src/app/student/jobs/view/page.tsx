import { Suspense } from 'react'
import StudentJobDetailPage from './_client'
import { DetailHeroSkeleton } from '@/components/ui/ContentSkeleton'

export default function Page() {
  return (
    <Suspense fallback={<DetailHeroSkeleton label="Loading application…" />}>
      <StudentJobDetailPage />
    </Suspense>
  )
}
