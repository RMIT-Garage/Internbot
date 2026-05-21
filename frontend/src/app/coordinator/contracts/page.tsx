import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import { CoordinatorContentSkeleton } from '@/components/coordinator/CoordinatorContentSkeleton'
import { ContractsList } from './ContractsList'

export default function CoordinatorContractsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Approval Queue"
        title="Contract Approvals"
        description="Review placement agreements with AI compliance checks, risk indicators, and coordinator audit context."
      />
      <Suspense fallback={<CoordinatorContentSkeleton title="Loading contracts…" />}>
        <ContractsList />
      </Suspense>
    </div>
  )
}
