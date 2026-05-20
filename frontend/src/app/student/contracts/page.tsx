import { Suspense } from 'react'
import { ContractsList } from './ContractsList'

function CoordinatorPageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">{eyebrow}</p>

      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>

      <p className="text-sm text-slate-600">{description}</p>
    </div>
  )
}

export default function CoordinatorContractsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Approval Queue"
        title="Contract Approvals"
        description="Review placement agreements with AI compliance checks, risk indicators, and coordinator audit context."
      />

      <Suspense fallback={<div className="text-sm text-zinc-500">Loading contracts...</div>}>
        <ContractsList />
      </Suspense>
    </div>
  )
}
