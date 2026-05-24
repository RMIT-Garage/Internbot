import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/student/Premium'
import { JobsList } from './JobsList'
import { ListRowsSkeleton } from '@/components/ui/ContentSkeleton'

export default function StudentApplicationsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Applications"
        title="My Applications"
        description="Track the status of your internship applications."
      />
      <Suspense fallback={<ListRowsSkeleton label="Loading applications…" />}>
        <JobsList />
      </Suspense>
    </div>
  )
}
