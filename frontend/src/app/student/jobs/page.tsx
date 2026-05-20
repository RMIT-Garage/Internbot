import { Suspense } from 'react'
import { CoordinatorPageHeader } from '@/components/student/Premium'
import { JobsList } from './JobsList'

export default function StudentApplicationsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Applications"
        title="My Applications"
        description="Track the status of your internship applications."
      />
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading jobs...</div>}>
        <JobsList />
      </Suspense>
    </div>
  )
}
