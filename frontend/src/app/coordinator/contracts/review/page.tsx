import { Suspense } from 'react'
import { ContractReviewClient } from './ContractReviewClient'

export default function CoordinatorContractReviewPage() {
  return (
    <Suspense fallback={<div className="text-sm text-zinc-500">Loading contract review...</div>}>
      <ContractReviewClient />
    </Suspense>
  )
}
