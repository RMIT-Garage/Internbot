import { Suspense } from 'react'
import { Download, UserPlus } from 'lucide-react'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
import CoordinatorContentSkeleton from '@/components/coordinator/CoordinatorContentSkeleton'
import { StudentsList } from './StudentsList'

export default function CoordinatorStudentsPage() {
  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Student Directory"
        title="Students"
        description="Search the WIL cohort, monitor placement states, and inspect student progress across programs."
        actions={
          <>
            <PendingActionButton message="Student export API integration pending.">
              <Download className="h-4 w-4" />
              Export
            </PendingActionButton>
            <PendingActionButton
              message="Add student API integration pending."
              className="border-red-700 bg-red-700 text-white hover:bg-red-800"
            >
              <UserPlus className="h-4 w-4" />
              Add student
            </PendingActionButton>
          </>
        }
      />
      <Suspense fallback={<CoordinatorContentSkeleton title="Loading students…" />}>
        <StudentsList />
      </Suspense>
    </div>
  )
}
