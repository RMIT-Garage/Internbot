import { Suspense } from 'react'
import { Download, UserPlus } from 'lucide-react'
import { PendingActionButton } from '@/components/coordinator/PendingActionButton'
import { CoordinatorPageHeader } from '@/components/coordinator/Premium'
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
      <Suspense fallback={<div className="text-sm text-zinc-500">Loading students...</div>}>
        <StudentsList />
      </Suspense>
    </div>
  )
}
