import { Suspense } from 'react'
import { ContractReviewClient } from './ContractReviewClient'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'

export default function CoordinatorContractReviewPage() {
  return (
    <Suspense fallback={<CoordinatorContentSkeleton title="Loading contract review…" />}>
      <ContractReviewClient />
    </Suspense>
  )
}
