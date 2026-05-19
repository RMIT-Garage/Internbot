'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api/client'

export type OpportunityType = 'pre_approved' | 'custom'
export type OpportunityWorkMode = 'on_site' | 'hybrid' | 'remote'
export type OpportunityStatus = 'draft' | 'open' | 'closed' | 'cancelled'

export interface Opportunity {
  id: string
  semesterId: string
  type: OpportunityType
  employerName: string
  jobTitle: string
  descriptionText: string
  workMode: OpportunityWorkMode | null
  location: string | null
  sourceUrl: string | null
  status: OpportunityStatus
  applicationCount: number
  createdAt: string
  updatedAt: string
}

interface OpportunityListResponse {
  items: Opportunity[]
  nextPageToken: string | null
}

interface UseOpportunitiesOptions {
  type?: OpportunityType
  workMode?: OpportunityWorkMode
}

interface UseOpportunitiesResult {
  opportunities: Opportunity[]
  loading: boolean
  error: string | null
  nextPageToken: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
}

export function useOpportunities(options: UseOpportunitiesOptions = {}): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextPageToken, setNextPageToken] = useState<string | null>(null)

  const buildUrl = useCallback(
    (pageToken?: string) => {
      const params = new URLSearchParams()
      if (options.type) params.set('type', options.type)
      if (pageToken) params.set('pageToken', pageToken)
      const qs = params.toString()
      return `/api/v1/opportunities${qs ? `?${qs}` : ''}`
    },
    [options.type]
  )

  const fetchOpportunities = useCallback(
    async (pageToken?: string, append = false) => {
      try {
        setError(null)
        if (!append) setLoading(true)
        const data = await apiFetch<OpportunityListResponse>(buildUrl(pageToken))
        setOpportunities((prev) => (append ? [...prev, ...data.items] : data.items))
        setNextPageToken(data.nextPageToken)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load opportunities')
      } finally {
        setLoading(false)
      }
    },
    [buildUrl]
  )

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  const loadMore = useCallback(async () => {
    if (!nextPageToken) return
    await fetchOpportunities(nextPageToken, true)
  }, [nextPageToken, fetchOpportunities])

  const refresh = useCallback(() => fetchOpportunities(), [fetchOpportunities])

  return { opportunities, loading, error, nextPageToken, loadMore, refresh }
}
