import { Suspense } from 'react'
import ApplicationDetailClient from './_client'

export default function ApplicationDetailPage() {
  return (
    <Suspense fallback={<div className="text-sm text-black/50">Loading application...</div>}>
      <ApplicationDetailClient />
    </Suspense>
  )
}
