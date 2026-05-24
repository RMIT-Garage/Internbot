import { Suspense } from 'react'
import { ContractsList } from './ContractsList'
import { Skeleton } from '@/components/ui/ContentSkeleton'

function LoadingFallback() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-black/10 bg-white p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-black/10 bg-white p-5">
            <Skeleton className="h-4 w-48" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StudentApplicationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-red-600 uppercase">
          My Applications
        </p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Applications</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track the status of your internship applications and offer submissions.
        </p>
      </div>

      <Suspense fallback={<LoadingFallback />}>
        <ContractsList />
      </Suspense>
    </div>
  )
}
