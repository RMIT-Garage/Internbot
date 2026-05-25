import { redirect } from 'next/navigation'
import { contractApprovals } from '@/lib/coordinator/mockData'

interface ContractCompatibilityPageProps {
  params: Promise<{ id: string }>
}

export function generateStaticParams() {
  return contractApprovals.map((contract) => ({ id: contract.id }))
}

export default async function CoordinatorContractCompatibilityPage({
  params,
}: ContractCompatibilityPageProps) {
  const { id } = await params
  redirect(`/coordinator/contracts/review?id=${encodeURIComponent(id)}`)
}
