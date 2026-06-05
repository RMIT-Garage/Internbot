/**
 * Next.js catch-all proxy route for the Firebase Functions backend.
 *
 * In local development the browser cannot call the Firebase Emulator directly
 * because the emulator does not add CORS headers to preflight responses.
 * This proxy sits on the same origin as the frontend (localhost:3000) and
 * forwards requests server-side, where CORS does not apply.
 *
 * Usage: /api/backend/<path> → <BACKEND_BASE>/api/<path>
 *
 * BACKEND_* must include the Functions **name** segment (this codebase exports `api`), e.g.
 * http://127.0.0.1:5001/{projectId}/{region}/api
 */

import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_FUNCTIONS_REGION = 'australia-southeast1'

function getBackendBase(): string {
  const explicit =
    process.env.BACKEND_API_BASE_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ?? ''
  if (explicit) return explicit.replace(/\/$/, '')

  const useEmulator =
    process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true' || process.env.USE_EMULATOR === 'true'

  if (useEmulator || process.env.NODE_ENV !== 'production') {
    const projectId =
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
      process.env.FIREBASE_PROJECT_ID ??
      'internbotrag'
    return `http://127.0.0.1:5001/${projectId}/${DEFAULT_FUNCTIONS_REGION}/api`.replace(/\/$/, '')
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    throw new Error(
      'Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID) — cannot derive production Functions URL for /api/backend proxy'
    )
  }

  // Firebase Functions v2 HTTPS URL shape (matches Express mounting under /api on function `api`)
  return `https://${DEFAULT_FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/api`.replace(
    /\/$/,
    ''
  )
}

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  let backendBase: string
  try {
    backendBase = getBackendBase()
  } catch (err) {
    console.error('[backend-proxy] Misconfigured backend base:', err)
    return NextResponse.json(
      { error: 'Server misconfigured', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
  const normalizedBase = backendBase.replace(/\/$/, '')
  const joinedPath = path.join('/')
  const candidates = Array.from(
    new Set([`${normalizedBase}/api/${joinedPath}`, `${normalizedBase}/${joinedPath}`])
  )

  // Forward the original request body and all headers (including Authorization)
  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined
  const headers = new Headers(req.headers)
  // Remove host so the upstream doesn't reject the request
  headers.delete('host')

  let upstreamRes: Response | undefined
  let lastError: unknown
  for (let i = 0; i < candidates.length; i++) {
    const upstreamUrl = candidates[i]!
    try {
      const res = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body,
      })
      // If route prefix is mismatched, try the next candidate before returning 404.
      if (res.status === 404 && i < candidates.length - 1) {
        continue
      }
      upstreamRes = res
      break
    } catch (err) {
      lastError = err
      if (i < candidates.length - 1) continue
    }
  }

  if (!upstreamRes) {
    console.error('[backend-proxy] Upstream fetch failed:', lastError)
    return NextResponse.json(
      { error: 'Backend unreachable', detail: String(lastError) },
      { status: 502 }
    )
  }

  const responseBody = await upstreamRes.text()
  const contentType = upstreamRes.headers.get('content-type') ?? 'application/json'

  return new NextResponse(responseBody, {
    status: upstreamRes.status,
    headers: { 'content-type': contentType },
  })
}

export const GET = proxy
export const POST = proxy
export const PUT = proxy
export const PATCH = proxy
export const DELETE = proxy
export const OPTIONS = proxy
