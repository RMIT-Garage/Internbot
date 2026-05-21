import { Suspense } from 'react'
import { ContractsList } from './ContractsList'
import { CoordinatorPageHeader } from '@/components/student/Premium'

export default function StudentContractsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="My Applications"
        title="Contracts"
        description="Track the status of your internship applications and offer submissions."
      />

      <Suspense fallback={<div className="text-sm text-slate-500">Loading contracts...</div>}>
        <ContractsList />
      </Suspense>
    </div>
  )
}
