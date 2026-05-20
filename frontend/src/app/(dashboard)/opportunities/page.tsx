'use client'

import { useRequireAuth } from '@/hooks/useRequireAuth'
import { InternshipsPage } from '@/features/opportunities/components/InternshipPage'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

export default function OpportunitiesPage() {
  const { ready } = useRequireAuth()
  if (!ready)
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner size="md" />
      </div>
    )
  return <InternshipsPage />
}
