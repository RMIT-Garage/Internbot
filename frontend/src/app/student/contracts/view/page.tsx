import { Suspense } from 'react'
import StudentContractDetailPage from './_client'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StudentContractDetailPage />
    </Suspense>
  )
}
