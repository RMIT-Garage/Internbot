import { Suspense } from 'react'
import StudentOpportunitiesPage from './OpportunitiesClient'

export default function StudentOpportunitiesRoute() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-500">Loading opportunities...</div>}>
      <StudentOpportunitiesPage />
    </Suspense>
  )
}
