import { Suspense } from 'react'
import StudentContractDetailPage from './_client'
import { DetailHeroSkeleton } from '@/components/ui/ContentSkeleton'

export default function Page() {
  return (
    <Suspense fallback={<DetailHeroSkeleton label="Loading contract…" />}>
      <StudentContractDetailPage />
    </Suspense>
  )
}
