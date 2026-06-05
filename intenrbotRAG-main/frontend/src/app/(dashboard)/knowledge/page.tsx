'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function KnowledgePage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/assistant')
  }, [router])

  // Knowledge page is intentionally disabled for now.
  // Full implementation was commented out to keep it available for future restore.
  return null
}
