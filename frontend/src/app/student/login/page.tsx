'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegacyStudentLoginPage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = new URLSearchParams(window.location.search).get('redirect')
    const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''
    router.replace(`/login${query}`)
  }, [router])

  return null
}
