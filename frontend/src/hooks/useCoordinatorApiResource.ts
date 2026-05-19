'use client'

import { useEffect, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/client'

interface CoordinatorApiResource<T> {
  data: T
  loading: boolean
  error: string | null
  source: 'api' | 'fallback'
  reload: () => void
  setData: (next: T) => void
}

interface CoordinatorApiResourceOptions<T> {
  emptyData?: T
}

export function useCoordinatorApiResource<T>(
  load: () => Promise<T>,
  fallback: T,
  depsKey = '',
  options: CoordinatorApiResourceOptions<T> = {}
): CoordinatorApiResource<T> {
  const getLoadingData = () => options.emptyData ?? fallback
  const [data, setData] = useState<T>(getLoadingData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'fallback'>('api')
  const [version, setVersion] = useState(0)
  const loadRef = useRef(load)
  const fallbackRef = useRef(fallback)
  const emptyDataRef = useRef(options.emptyData)

  useEffect(() => {
    loadRef.current = load
    fallbackRef.current = fallback
    emptyDataRef.current = options.emptyData
  }, [load, fallback, options.emptyData])

  useEffect(() => {
    let active = true
    queueMicrotask(() => {
      if (!active) return
      setData(emptyDataRef.current ?? fallbackRef.current)
      setLoading(true)
      setError(null)
      setSource('api')
    })

    Promise.resolve()
      .then(() => loadRef.current())
      .then((next) => {
        if (!active) return
        setData(next)
        setSource('api')
      })
      .catch((err: unknown) => {
        if (!active) return
        const canUseFallback = !(err instanceof ApiError)
        if (process.env.NODE_ENV === 'development') {
          console.debug('[coordinator-resource] load failed', {
            depsKey,
            fallbackActivated: canUseFallback,
            reason: err instanceof Error ? err.message : 'Backend API unavailable',
            apiStatus: err instanceof ApiError ? err.status : undefined,
            mode: canUseFallback
              ? 'using isolated fallback/mock data'
              : 'showing API error with empty data',
          })
        }
        setData(
          canUseFallback ? fallbackRef.current : (emptyDataRef.current ?? fallbackRef.current)
        )
        setSource(canUseFallback ? 'fallback' : 'api')
        setError(err instanceof Error ? err.message : 'Backend API unavailable')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [version, depsKey])

  return {
    data,
    loading,
    error,
    source,
    reload: () => setVersion((current) => current + 1),
    setData,
  }
}
