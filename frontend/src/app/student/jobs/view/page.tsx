import { Suspense } from 'react'
import StudentJobDetailPage from './_client'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <StudentJobDetailPage />
    </Suspense>
  )
}
