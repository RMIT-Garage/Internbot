'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api/client'
import type { TicketListItemResponse } from '@/api/models/TicketListItemResponse'
import type { TicketResponse } from '@/api/models/TicketResponse'
import type { TicketListResponse } from '@/api/models/TicketListResponse'

export type { TicketListItemResponse, TicketResponse }

export function useTickets(refreshTrigger?: number) {
  const [tickets, setTickets] = useState<TicketListItemResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const prevTriggerRef = useRef(refreshTrigger)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<TicketListResponse>('/api/v1/tickets?sort=-createdAt')
      setTickets(data.items ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets])

  useEffect(() => {
    if (refreshTrigger !== undefined && refreshTrigger !== prevTriggerRef.current) {
      prevTriggerRef.current = refreshTrigger
      fetchTickets()
    }
  }, [refreshTrigger, fetchTickets])

  return { tickets, loading, error, refresh: fetchTickets }
}
