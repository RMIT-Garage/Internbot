# Internbot — Frontend package

Next.js 16 **static export** SPA: student and coordinator internship workflows. Part of the [Internbot monorepo](../README.md) — start with the **root README codebase guide** for full system context.

## Team

| Name                         | Student ID |
| ---------------------------- | ---------- |
| Duc Gia Tin Huynh            | s3962053   |
| Edelyne Keisha Tjhin         | s4190528   |
| Amantha Mampitiya Arachchige | s3992315   |
| Heethasha Sandeep Kumar      | s3906349   |
| Dan Dang                     | s4059981   |

---

## How this package fits in

The browser only talks to:

1. **Firebase Auth** — sign-in, sign-up, ID tokens (`@/lib/firebase/`).
2. **Internbot HTTP API** — every list, form, and mutation via `apiFetch('/api/v1/...')` (`@/lib/api/client.ts`).

There is **no** `firebase/firestore` or `firebase/storage` for domain data. Firestore rules deny client access; the backend owns all reads/writes.

Hosting serves `frontend/out/` after `pnpm --filter frontend build`. In production, `/api/**` is rewritten to the `api` Cloud Function (see root `firebase.json`).

---

## Directory map

```text
frontend/src/
├── app/                    # Routes (file-based App Router)
│   ├── page.tsx            # Landing
│   ├── (auth)/             # Login, register, verify-email, forgot-password
│   ├── (onboarding)/       # Student onboarding wizard steps
│   ├── student/            # Student app (dashboard, jobs, advisor, …)
│   ├── coordinator/        # Coordinator app (semesters, contracts, tickets, …)
│   └── dashboard/          # Legacy entry / redirects
├── features/               # Domain UI (prefer adding here)
│   ├── auth/
│   ├── onboarding/
│   ├── profile/
│   ├── advisor/            # Student FAQ + tickets
│   └── coordinator-ai/     # Coordinator AI tools
├── components/             # Shared UI
│   ├── layout/             # Shell, sidebar, navbar
│   ├── student/            # Student-specific widgets
│   ├── coordinator/
│   ├── shared/
│   └── ui/                 # shadcn — do not hand-edit
├── lib/
│   ├── api/client.ts       # apiFetch — always use for backend
│   ├── firebase/           # Auth client only
│   ├── coordinator/        # Coordinator API helpers + route guard
│   └── validations/        # Zod schemas for forms
├── hooks/                  # useAuth, useRequireAuth, …
└── providers/              # AuthProvider, Toaster
```

---

## Routing and roles

| Prefix           | Who             | Notes                                      |
| ---------------- | --------------- | ------------------------------------------ |
| `/student/*`     | Students        | Main post-onboarding experience            |
| `/coordinator/*` | Coordinators    | Separate login at `/coordinator/login`     |
| `(onboarding)/*` | New students    | Profile, credits, semester before full app |
| `(auth)/*`       | Unauthenticated | Redirect if already signed in              |

Protected layouts use `useRequireAuth()` from `@/hooks/`. Role-specific guards also live in coordinator helpers (`useCoordinatorRouteGuard`).

---

## Patterns you should follow

### Client components

Add `'use client'` when using hooks, `onClick`, `apiFetch`, or `useAuth`. Pages that show user-specific data are almost always client components.

### Calling the API

```typescript
import { apiFetch } from '@/lib/api/client'

const me = await apiFetch<User>('/api/v1/users/me')
await apiFetch('/api/v1/semesters', { method: 'POST', body: { ... } })
```

- Base URL: `NEXT_PUBLIC_API_URL` (often `http://localhost:5000` with Hosting emulator, or function URL — see `.env.example`).
- Paths always include the `/api/v1/...` prefix.
- Do not use raw `fetch()` for backend calls (you will lose the auth header).

### Feature modules

Put new business UI in `src/features/<name>/`:

- `components/` — screens and panels
- `hooks/` — data hooks wrapping `apiFetch`
- `types.ts` — view models and API types

Avoid cross-importing between features; use `@/lib`, `@/hooks`, `@/components/shared`.

### Styling

Tailwind v4, tokens in `src/app/globals.css` (`@theme`). Use `cn()` from `@/lib/utils`. Follow [docs/DESIGN.md](../docs/DESIGN.md).

---

## Auth flow (UI)

```text
/register or /login → Firebase Auth
       → GET /api/v1/users/me
       → 403 no_platform_user → /verify-email
       → student → onboarding or /student/dashboard
       → coordinator → /coordinator/dashboard
```

`AuthProvider` (`src/providers/`) listens to `onAuthStateChanged` only — it does not write to Firestore.

---

## Local development

From **repo root** (starts emulators + frontend):

```bash
pnpm run dev
```

Frontend only:

```bash
pnpm --filter frontend dev
```

Env: copy `frontend/.env.example` → `frontend/.env.local`. See [root README § Environment setup](../README.md#environment-setup).

---

## Scripts

```bash
pnpm --filter frontend dev
pnpm --filter frontend build    # Output: frontend/out/
pnpm --filter frontend test
pnpm --filter frontend lint
pnpm --filter frontend typecheck
```

---

## Further reading

| Topic                    | Document                                                     |
| ------------------------ | ------------------------------------------------------------ |
| Full monorepo guide      | [../README.md](../README.md)                                 |
| Frontend conventions     | [../docs/FRONTEND.md](../docs/FRONTEND.md)                   |
| API contract             | [../docs/WORKFLOW-API-SPEC.md](../docs/WORKFLOW-API-SPEC.md) |
| Design system            | [../docs/DESIGN.md](../docs/DESIGN.md)                       |
| Package rules for agents | [CLAUDE.md](./CLAUDE.md)                                     |
