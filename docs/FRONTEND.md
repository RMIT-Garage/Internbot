# Frontend

## Overview

Next.js 16 App Router with React 19, TypeScript (strict), and Tailwind CSS v4. **Built as a static export (`output: 'export'`) and deployed to Firebase Hosting — no Node runtime, no SSR.**

## Key Conventions

### Server vs Client Components

- Server Components run at **build time only** (static export) — they can't read request state
- Add `'use client'` when you need: React hooks, event handlers, browser APIs, auth state, Firebase client SDK, `apiFetch`
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
├── types.ts          TypeScript interfaces
├── hooks/
│   └── useInvoices.ts  Firestore subscription hook
├── api/
│   └── invoices.api.ts  apiFetch wrappers for backend mutations
└── components/
    └── InvoiceList.tsx
```

Use the `/new-feature` skill to scaffold this structure.

### Data Fetching

| Context                  | Method                           | When                             |
| ------------------------ | -------------------------------- | -------------------------------- |
| Build-time Server Comp.  | none — no data fetching possible | Static content only              |
| Client Component (read)  | `useCollection()` hook           | Firestore real-time subscription |
| Client Component (write) | `apiFetch('/path', { method })`  | Mutations via backend API        |

All data mutations go through the backend API (`apiFetch`). Firestore writes from the frontend are only allowed for paths explicitly permitted by security rules.

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
/ (landing) → /login → /dashboard
                ↓
           /register → /dashboard
```

- `AuthProvider` wraps the root layout, subscribes to `onAuthStateChanged`
- `useAuth()` reads auth state in any client component
- `useRequireAuth()` in the `(dashboard)` layout redirects to `/login` if no user
- `useRedirectIfAuthed()` in `(auth)` pages pushes to `/dashboard` if already signed in
- Backend calls use `apiFetch`, which attaches `Authorization: Bearer <idToken>` automatically

## Adding a Page

Use the `/new-page` skill. Key checklist:

- Correct route group (`(auth)` or `(dashboard)`)
- Static `metadata` on server components; client pages set `document.title` via effect if needed
- Protected pages sit under `(dashboard)` — the layout already calls `useRequireAuth()`
- Any interactivity or auth-aware UI is `'use client'`
