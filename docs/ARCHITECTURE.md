# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  Next.js 16 (React 19)                                          │
│  ├── App Router (Server Components + Client Components)          │
│  ├── Firebase Auth (client-side session management)              │
│  └── Firestore (real-time subscriptions in client components)    │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌─────────────────────┐
│  Firebase App   │      │  Cloud Functions v2  │
│  Hosting        │      │  (Express fat-lambda)│
│  (frontend)     │      │  /api/*              │
└─────────────────┘      └─────────┬───────────┘
                                   │ Admin SDK
                         ┌─────────▼───────────┐
                         │     Firebase         │
                         │  ├── Auth            │
                         │  ├── Firestore        │
                         │  └── Storage          │
                         └─────────────────────┘
```

## Request Patterns

### Server-Rendered Page (Server Component)

1. Browser requests `/dashboard`
2. Next.js middleware checks `__session` cookie → authenticated
3. Server Component renders, fetching Firestore data via Firebase Admin SDK
4. HTML streamed to browser

### Client-Side Real-time Data

1. Client Component mounts
2. `useCollection()` hook subscribes to Firestore via `onSnapshot`
3. UI updates live as Firestore data changes

### API Call (Cloud Functions)

1. Client obtains Firebase ID token: `user.getIdToken()`
2. Client sends `Authorization: Bearer {token}` to `/api/...`
3. `authMiddleware` verifies token via Admin SDK
4. Route handler queries Firestore and returns response

### Authentication Flow

1. User submits credentials → Firebase Auth signs in (client-side)
2. `onAuthStateChanged` fires → `AuthProvider` gets user
3. Client POSTs ID token to `/api/auth/session`
4. Server creates a Firebase session cookie (14 days) → set as HttpOnly
5. All subsequent page loads: middleware reads cookie → no redirect

## Security Model

- **Firestore rules** — last line of defence; always assume clients are untrusted
- **Cloud Functions** — verify ID tokens in `authMiddleware` for every protected route
- **Next.js Server Actions** — call `requireAuth()` (verifies session cookie via Admin SDK) before any data operation
- **Middleware** — optimistic cookie check only; never relies on this for security, only for redirects

## Key Design Decisions

**Why session cookies instead of just Firebase client auth?**
Next.js middleware runs on the Edge runtime and cannot use the Firebase Admin SDK (too heavy). The session cookie gives a lightweight signal to middleware for redirects. Cryptographic trust is established server-side near the data.

**Why feature-based folder structure?**
Features in `src/features/{feature}/` are self-contained — types, hooks, actions, and components together. Deleting a feature means deleting one folder. Cross-feature imports are explicit violations of the intended boundary.

**Why Express on Cloud Functions instead of individual functions?**
The "fat-lambda" pattern keeps local development identical to production (just run Express locally), simplifies testing with supertest, and avoids cold start multiplied across many functions.
