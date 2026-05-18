# Frontend

## Overview

Next.js 16 App Router with React 19, TypeScript (strict), and Tailwind CSS v4. **Built as a static export (`output: 'export'`) and deployed to Firebase Hosting — no Node runtime, no SSR.**

## Key Conventions

### Server vs Client Components

- Server Components run at **build time only** (static export) — they can't read request state
- Add `'use client'` when you need: React hooks, event handlers, browser APIs, auth state, Firebase Auth SDK, `apiFetch`
- Any page that reads the authenticated user must be `'use client'`

### Route Groups

| Group         | Path                                  | Purpose                              |
| ------------- | ------------------------------------- | ------------------------------------ |
| `(auth)`      | `/login`, `/register`                 | Minimal centered layout, no sidebar  |
| `(dashboard)` | `/dashboard`, `/profile`, `/settings` | Full app shell with sidebar + navbar |
| _(root)_      | `/`                                   | Landing/marketing page               |

### Feature Modules

New business domains go in `src/features/{feature}/`:

```
src/features/invoices/
├── types.ts             TypeScript interfaces
├── hooks/
│   └── useInvoices.ts   React Query hook backed by apiFetch
├── api/
│   └── invoices.api.ts  apiFetch wrappers for backend reads + mutations
└── components/
    └── InvoiceList.tsx
```

Use the `/new-feature` skill to scaffold this structure.

### Data Fetching

| Context                       | Method                          | When                           |
| ----------------------------- | ------------------------------- | ------------------------------ |
| Build-time Server Comp.       | none — no data fetching         | Static content only            |
| Client Component (read/write) | `apiFetch('/path', { method })` | All domain reads and mutations |

**Frontend talks to two surfaces only — Firebase Auth SDK and the backend API.**

- The Firebase Auth SDK is used for sign-in, sign-up, `onAuthStateChanged`, ID-token retrieval, and password/verification email helpers.
- Every domain read or write goes through `apiFetch` to a backend `/api/v1/...` endpoint. The backend owns all Firestore and Cloud Storage access.
- The frontend must NOT import `firebase/firestore` (no `getFirestore`, `doc`, `collection`, `getDoc`, `setDoc`, `onSnapshot`) or `firebase/storage` for direct uploads/downloads. Firestore security rules will refuse client-SDK access for domain collections.
- Real-time UI updates use polling/refetch via React Query (or server-sent events from the backend), not Firestore listeners.

### Styling

Tailwind CSS v4 uses CSS-first config. Key patterns:

```tsx
// Conditional classes
import { cn } from '@/lib/utils'
<div className={cn('base-class', isActive && 'active-class', className)} />

// Dark mode: use Tailwind dark: prefix
<div className="bg-white dark:bg-zinc-900" />
```

## Authentication UI Flow

```
/ (landing) → /login → (email verified?) → /dashboard
                ↓               ↓
           /register      /verify-email
```

- `AuthProvider` wraps the root layout and subscribes to `onAuthStateChanged`. It never writes to Firestore — the backend JIT-creates the platform `users/{id}` document on the first authenticated `GET /api/v1/users/me` call from a verified email.
- `useAuth()` reads auth state in any client component
- `useRequireAuth()` in the `(dashboard)` layout redirects to `/login` if no user
- `useRedirectIfAuthed()` in `(auth)` pages pushes to `/dashboard` if already signed in
- After sign-up or sign-in, the frontend calls `GET /api/v1/users/me` to gate access. A `403 no_platform_user` response means the Firebase email is not yet verified — route the user to `/verify-email`.
- Backend calls use `apiFetch`, which attaches `Authorization: Bearer <idToken>` automatically.

## Adding a Page

Use the `/new-page` skill. Key checklist:

- Correct route group (`(auth)` or `(dashboard)`)
- Static `metadata` on server components; client pages set `document.title` via effect if needed
- Protected pages sit under `(dashboard)` — the layout already calls `useRequireAuth()`
- Any interactivity or auth-aware UI is `'use client'`
