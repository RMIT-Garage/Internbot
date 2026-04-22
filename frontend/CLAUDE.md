# Frontend — Claude Instructions

Loaded automatically when editing files in `frontend/`. Supplements root `CLAUDE.md`.

---

## Next.js 16 — static export (SPA mode)

This frontend is built with `output: 'export'` and deploys to Firebase Hosting as plain static assets. **There is no Node runtime.**

That means the following Next.js features are **disabled** and must not be used:

- Server Actions (`'use server'`)
- Route handlers (`src/app/api/**`)
- Async Server Components (can't `await` work at request time)
- `middleware.ts` / `proxy.ts`
- `next/image` optimization (we use `images.unoptimized = true`)
- `headers()`, `cookies()` from `next/headers`
- Any import of `firebase-admin`

Use `node_modules/next/dist/docs/` to check Next 16 specifics before writing new code.

---

## Server vs Client Components

Server Components still exist (they run at build time for static export), but anything interactive needs `'use client'`. Add it when you need:

- React hooks (`useState`, `useEffect`, `useContext`, etc.)
- Event handlers (`onClick`, `onChange`, etc.)
- Browser APIs (`window`, `localStorage`, `navigator`, etc.)
- `useAuth`, `apiFetch`, Firebase client SDK

Pages that read authenticated user state must be `'use client'` — the user is only known in the browser, not at build time.

---

## File Organization

```
src/
├── app/
│   ├── (auth)/           # Login, register — client pages, redirect-if-authed
│   ├── (dashboard)/      # Protected pages — useRequireAuth in layout
│   ├── layout.tsx        # Root layout — static Server Component
│   └── page.tsx          # Landing page — static Server Component
├── components/
│   ├── layout/           # DashboardShell, Sidebar, Navbar, PageHeader
│   ├── shared/           # ErrorBoundary, LoadingSpinner, EmptyState
│   └── ui/               # shadcn/ui (do not edit — regenerate with CLI)
├── features/             # One folder per business domain
│   └── [domain]/
│       ├── components/
│       ├── hooks/
│       └── types.ts
├── lib/
│   ├── api/
│   │   └── client.ts     # apiFetch<T>() — adds Bearer token automatically
│   ├── firebase/
│   │   ├── client.ts     # Client SDK singleton
│   │   ├── auth.ts       # Sign-in helpers
│   │   ├── firestore.ts  # typedCollection<T>() factory
│   │   └── storage.ts    # Upload helpers
│   ├── validations/      # Zod schemas for forms
│   └── utils.ts          # cn(), formatDate(), truncate()
├── hooks/                # Cross-domain hooks — useAuth, useRequireAuth
├── providers/            # AuthProvider, Toaster
└── types/                # Shared TypeScript types
```

**Import rules:**

- Always use `@/` alias — never `../../` more than one level
- Features import from `@/lib/`, `@/hooks/`, `@/types/` but not from other features
- `app/` pages import from `@/components/`, `@/features/`, `@/hooks/`
- Never import `firebase-admin` — it's not a dependency of this package

---

## Backend API calls — `apiFetch`

All backend calls go through `@/lib/api/client`:

```typescript
import { apiFetch } from '@/lib/api/client'

const user = await apiFetch<User>('/users/me')
await apiFetch('/users/me', { method: 'PATCH', body: { displayName: 'Jane' } })
```

- `apiFetch` reads `NEXT_PUBLIC_API_URL` (baked at build time)
- If a Firebase user is signed in, it attaches `Authorization: Bearer <idToken>`
- Non-2xx responses throw `ApiError` with status + parsed body
- JSON request bodies are stringified automatically; don't pre-serialize

Never call the backend with a raw `fetch()` — you'll lose the auth header.

---

## Auth Flow (client-only)

1. User signs in via `@/lib/firebase/auth` (client SDK)
2. `onAuthStateChanged` in `AuthProvider` fires → `user` is set
3. `AuthProvider` syncs the profile doc to Firestore (`users/{uid}`)
4. Protected routes use `useRequireAuth()` in their layout — redirects to `/login` if no user
5. Login/register pages use `useRedirectIfAuthed()` — pushes to `/dashboard` if already signed in
6. Backend authz: every API call attaches a fresh ID token; backend verifies via `authMiddleware`

There is **no session cookie and no server-side auth verification in the frontend**. All security happens at the backend/Firestore-rules boundary.

---

## Design System

See `docs/DESIGN.md` for the full design reference:

- Tailwind v4 CSS-first config, `@theme` tokens
- Color system, typography scale, spacing
- Button, input, card, badge patterns
- Loading/error/empty state patterns
- Icon sizing conventions (lucide-react)
- Form pattern (react-hook-form + zod + sonner)

---

## Testing

Tests live in `frontend/tests/unit/` mirroring `src/`.

- `vi.mock('@/lib/firebase/client')` in setup
- Use `@testing-library/react` for components, `renderHook` for hooks
- Do not test `src/components/ui/` (shadcn) or `src/app/` pages
