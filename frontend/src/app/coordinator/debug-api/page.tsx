'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { User } from 'firebase/auth'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { apiFetch, ApiError } from '@/lib/api/client'
import { CoordinatorPageHeader, SurfaceCard } from '@/components/coordinator/Premium'

interface DebugEndpointResult {
  label: string
  path: string
  ok: boolean
  status: number | null
  itemCount: number | null
  body: unknown
  error: string | null
}

const debugEndpoints = [
  { label: 'Current user', path: '/api/v1/users/me' },
  { label: 'Internships', path: '/api/v1/internships?limit=100&sort=-lastSubmittedAt' },
  {
    label: 'Offer review queue',
    path: '/api/v1/internships?status=offer_pending_review&limit=100&sort=-lastSubmittedAt',
  },
  { label: 'Opportunities', path: '/api/v1/opportunities?limit=100&sort=-createdAt' },
  {
    label: 'Placement review opportunities',
    path: '/api/v1/opportunities?type=custom&limit=100&sort=-createdAt',
  },
  { label: 'Semesters', path: '/api/v1/semesters?limit=100' },
  { label: 'Notifications', path: '/api/v1/notifications?limit=50' },
  { label: 'My activity', path: '/api/v1/users/me/activity?limit=20' },
] as const

const coordinatorAuditChecklist = [
  'Auth: shared Firebase/backend login, coordinator/staff/admin role guard, no coordinator-only login form.',
  'Dashboard: internships, opportunities, notifications, and activity endpoints connected with empty/error states.',
  'Students: internship-derived directory with stable row keys, loading/empty/error states.',
  'Jobs: custom opportunities list, static-export-safe review links, verification actions through opportunity verification endpoint.',
  'Contracts: internship offer review queue, static-export-safe review links, decisions endpoint for approve/reject/request changes.',
  'Semesters: list, create, and display-name update wired to semester endpoints.',
  'Opportunities: list, create, and editable title/employer fields wired to opportunity endpoints.',
  'Notifications: list, mark one read, and mark all read states wired to notification endpoints.',
  'AI insights: backend integration pending until an AI review endpoint exists.',
  'Tickets: no coordinator ticket frontend route is present, so ticket APIs are not surfaced.',
] as const

export default function CoordinatorDebugApiPage() {
  const { user, profile, loading, needsVerification } = useAuth()
  const [firebaseCurrentUserPresent, setFirebaseCurrentUserPresent] = useState(false)
  const [firebaseTokenPresent, setFirebaseTokenPresent] = useState(false)
  const [firebaseUserEmail, setFirebaseUserEmail] = useState<string | null>(null)
  const [firebaseAuthError, setFirebaseAuthError] = useState<string | null>(null)
  const [results, setResults] = useState<DebugEndpointResult[]>([])
  const [running, setRunning] = useState(false)

  const isDevelopment = process.env.NODE_ENV === 'development'
  const authSummary = useMemo(
    () => ({
      providerUserPresent: Boolean(user),
      providerEmail: user?.email ?? null,
      profileRole: profile?.role ?? null,
      firebaseCurrentUserPresent,
      firebaseUserEmail,
      firebaseTokenPresent,
      firebaseAuthError,
      needsVerification,
    }),
    [
      user,
      profile,
      firebaseCurrentUserPresent,
      firebaseUserEmail,
      firebaseTokenPresent,
      firebaseAuthError,
      needsVerification,
    ]
  )

  const runChecks = useCallback(async () => {
    setRunning(true)
    let currentUser: User | null = null
    setFirebaseAuthError(null)
    try {
      const firebaseClient = await import('@/lib/firebase/client')
      currentUser = firebaseClient.auth.currentUser
    } catch (error) {
      const message =
        error instanceof Error
          ? `Firebase auth unavailable: ${error.message}`
          : 'Firebase auth unavailable in this environment.'
      setFirebaseAuthError(message)
      setFirebaseCurrentUserPresent(false)
      setFirebaseUserEmail(null)
      setFirebaseTokenPresent(false)
    }
    setFirebaseUserEmail(currentUser?.email ?? null)
    setFirebaseCurrentUserPresent(Boolean(currentUser))
    if (currentUser) {
      const token = await currentUser.getIdToken().catch(() => '')
      setFirebaseTokenPresent(token.length > 0)
      if (process.env.NODE_ENV === 'development') {
        console.debug('[coordinator/debug-api] Firebase token presence', {
          present: token.length > 0,
          uid: currentUser.uid,
          email: currentUser.email,
        })
      }
    } else {
      setFirebaseTokenPresent(false)
      if (process.env.NODE_ENV === 'development') {
        console.debug('[coordinator/debug-api] Firebase token presence', {
          present: false,
          reason: 'auth.currentUser is null',
        })
      }
    }

    const nextResults = await Promise.all(debugEndpoints.map(runEndpoint))
    setResults(nextResults)
    setRunning(false)
  }, [])

  useEffect(() => {
    if (!loading && isDevelopment) {
      queueMicrotask(() => {
        void runChecks()
      })
    }
  }, [loading, isDevelopment, runChecks])

  if (!isDevelopment) {
    return (
      <div className="space-y-6">
        <CoordinatorPageHeader
          eyebrow="Development Tool"
          title="Coordinator API Debug"
          description="This route is available only in development mode."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CoordinatorPageHeader
        eyebrow="Development Tool"
        title="Coordinator API Debug"
        description="Raw auth and backend API diagnostics for coordinator workflow integration."
        actions={
          <button
            type="button"
            onClick={runChecks}
            disabled={running}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {running ? 'Checking...' : 'Run checks'}
          </button>
        }
      />

      <SurfaceCard className="p-5">
        <h2 className="font-bold text-slate-950">Auth Status</h2>
        <pre className="mt-4 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {JSON.stringify(authSummary, null, 2)}
        </pre>
      </SurfaceCard>

      <SurfaceCard className="p-5">
        <h2 className="font-bold text-slate-950">Coordinator Frontend Audit Checklist</h2>
        <ul className="mt-4 space-y-2 text-sm text-slate-600">
          {coordinatorAuditChecklist.map((item) => (
            <li key={item} className="rounded-xl bg-slate-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>
      </SurfaceCard>

      <div className="grid gap-4">
        {results.map((result) => (
          <SurfaceCard key={result.path} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">{result.label}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{result.path}</p>
              </div>
              <span
                className={
                  result.ok
                    ? 'rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-950'
                    : 'rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700'
                }
              >
                {result.ok ? 'OK' : 'ERROR'} {result.status ?? ''}
              </span>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Status</p>
                <p className="mt-1 font-bold text-slate-950">{result.status ?? 'n/a'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Item count</p>
                <p className="mt-1 font-bold text-slate-950">{result.itemCount ?? 'not a list'}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-500 uppercase">Fallback</p>
                <p className="mt-1 font-bold text-slate-950">never used on this debug route</p>
              </div>
            </div>
            <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {JSON.stringify(
                result.error ? { error: result.error, body: result.body } : result.body,
                null,
                2
              )}
            </pre>
          </SurfaceCard>
        ))}
      </div>
    </div>
  )
}

async function runEndpoint(endpoint: {
  label: string
  path: string
}): Promise<DebugEndpointResult> {
  try {
    const body = await apiFetch<unknown>(endpoint.path)
    return {
      label: endpoint.label,
      path: endpoint.path,
      ok: true,
      status: 200,
      itemCount: getItemCount(body),
      body,
      error: null,
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        label: endpoint.label,
        path: endpoint.path,
        ok: false,
        status: error.status,
        itemCount: getItemCount(error.body),
        body: error.body,
        error: error.message,
      }
    }

    return {
      label: endpoint.label,
      path: endpoint.path,
      ok: false,
      status: null,
      itemCount: null,
      body: null,
      error: error instanceof Error ? error.message : 'Unknown debug request error',
    }
  }
}

function getItemCount(body: unknown): number | null {
  if (typeof body !== 'object' || body === null || !('items' in body)) {
    return null
  }
  const items = (body as { items?: unknown }).items
  return Array.isArray(items) ? items.length : null
}
