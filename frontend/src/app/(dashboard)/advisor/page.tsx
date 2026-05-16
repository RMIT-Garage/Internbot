'use client'

import { useRequireAuth } from '@/hooks/useRequireAuth'
import { AIAdvisorPortal } from '@/features/advisor/components/AIAdvisorPortal'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export default function AdvisorPage() {
  const { ready } = useRequireAuth()
  if (!ready)
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  return <AIAdvisorPortal />
}
