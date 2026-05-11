# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  Next.js 16 (React 19) — static export (SPA)                    │
│  ├── App Router (client components only, no SSR)                │
│  ├── Firebase Auth (client-side session, ID token in memory)    │
│  └── Firestore (real-time subscriptions in client components)   │
└────────────────────┬────────────────────────────────────────────┘
                     │ HTTPS
         ┌───────────┴──────────────┐
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌─────────────────────┐
│  Firebase        │      │  Cloud Functions v2  │
│  Hosting         │      │  (Express fat-lambda)│
│  (static assets) │      │  /api/*              │
└─────────────────┘      └─────────┬───────────┘
                                   │ Admin SDK
                         ┌─────────▼───────────┐
                         │     Firebase         │
                         │  ├── Auth            │
                         │  ├── Firestore       │
                         │  └── Storage         │
                         └─────────────────────┘
```

## Request Patterns

### Static Page Load

1. Browser requests `/dashboard/` → Firebase Hosting serves `dashboard/index.html`
2. Bundled JS boots; `AuthProvider` subscribes via `onAuthStateChanged`
3. `useRequireAuth()` redirects to `/login/` if no user once auth state resolves

### API Call (Cloud Functions)

1. Client calls `apiFetch('/path')` — the helper pulls the current Firebase user
2. `user.getIdToken()` returns a fresh ID token
3. Request goes out with `Authorization: Bearer {token}`
4. Backend `authMiddleware` verifies the token via Admin SDK
5. Route handler queries Firestore and returns response

### Authentication Flow

1. User submits credentials → Firebase Auth signs in (client SDK)
2. `onAuthStateChanged` fires → `AuthProvider` sets `user`, syncs profile doc
3. Subsequent `apiFetch` calls attach `Authorization: Bearer <idToken>`
4. Client-side route guards (`useRequireAuth`) handle redirects for unauthed users

## Security Model

- **Firestore rules** — `default-deny` for every collection. The public web config (project ID + API key) ships in the bundle, so any token holder can hit `firestore.googleapis.com` directly; we treat the database as backend-only and never grant client tokens read or write access.
- **Cloud Functions** — verify ID tokens in `authMiddleware` on every protected route. The Admin SDK bypasses Firestore rules, so the backend is the only path that touches data.
- **Frontend auth guards** — client-side only; they gate UX, not data. Every protected resource is authorized at the API layer.
- **No client SDK Firestore** — the frontend bundle does not initialise `getFirestore()`. All reads/writes go through `apiFetch` to the backend.
- **Admin SDK** — backend only; the frontend package does not import `firebase-admin`.

## Key Design Decisions

**Why static export instead of SSR?**
Auth and authz always happen at the data boundary (Cloud Functions + Firestore rules), so rendering HTML on a server adds no security value. Dropping SSR removes the session-cookie round-trip, removes an Admin-SDK dependency from the frontend bundle/build, and lets the frontend deploy as plain static assets — cheaper, faster, and with a smaller attack surface.

**Why ID tokens in `Authorization: Bearer` instead of session cookies?**
Cookies need a server to mint and verify; a static SPA has no server. Firebase ID tokens are short-lived (1h) and self-contained, and the client SDK refreshes them automatically. The backend verifies each request independently.

**Why feature-based folder structure?**
Features in `src/features/{feature}/` are self-contained — types, hooks, actions, and components together. Deleting a feature means deleting one folder. Cross-feature imports are explicit violations of the intended boundary.

**Why Express on Cloud Functions instead of individual functions?**
The "fat-lambda" pattern keeps local development identical to production (just run Express locally), simplifies testing with supertest, and avoids cold start multiplied across many functions.
