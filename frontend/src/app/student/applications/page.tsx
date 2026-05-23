import { Suspense } from 'react'
import { ContractsList } from './ContractsList'
import { CoordinatorPageHeader } from '@/components/student/Premium'
import { ListRowsSkeleton } from '@/components/ui/ContentSkeleton'

export default function StudentApplicationsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="My Applications"
        title="Applications"
        description="Track the status of your internship applications and offer submissions."
      />

      <Suspense fallback={<ListRowsSkeleton label="Loading applications…" />}>
        <ContractsList />
      </Suspense>
    </div>
  )
}
