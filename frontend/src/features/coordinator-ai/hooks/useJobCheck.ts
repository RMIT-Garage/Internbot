'use client'

import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { CheckerResponse } from '../types'

interface CheckState {
  result: CheckerResponse | null
  isLoading: boolean
  error: string | null
}

export function useJobCheck(userInput: string | null) {
  const [state, setState] = useState<CheckState>({ result: null, isLoading: false, error: null })
  const hasFired = useRef(false)

  useEffect(() => {
    if (!userInput || hasFired.current) return
    hasFired.current = true

    let active = true

    queueMicrotask(() => {
      if (!active) return
      setState({ result: null, isLoading: true, error: null })
    })

    apiFetch<CheckerResponse>('/api/v1/coordinator/ai/job-check', {
      method: 'POST',
      body: { userInput },
    })
      .then((data) => {
        if (active) setState({ result: data, isLoading: false, error: null })
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            result: null,
            isLoading: false,
            error: err instanceof Error ? err.message : 'AI check failed',
          })
      })

    return () => {
      active = false
    }
  }, [userInput])

  return state
}
