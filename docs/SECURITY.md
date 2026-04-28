# Security

## Overview

Security is enforced in layers — each layer is independent so a failure in one does not collapse the others.

| Layer        | Mechanism                                                     |
| ------------ | ------------------------------------------------------------- |
| Pre-commit   | gitleaks secret scan (required)                               |
| Claude Code  | Deny rules, PreToolUse/PostToolUse hooks                      |
| HTTP         | helmet headers, CORS policy, rate limiting, body size cap     |
| Auth         | Firebase ID token verification (Bearer tokens, per request)   |
| API          | Zod input validation, actor-based access control              |
| Data         | Firestore security rules (default deny, field allowlists)     |
| CI           | gitleaks action + `pnpm audit --audit-level=high` on every PR |
| Dependencies | Dependabot weekly PRs for the root pnpm workspace and Actions |

---

## Secret Scanning

`gitleaks` runs on every `git commit` via the Lefthook `pre-commit` hook. It is **required** — the hook fails hard if gitleaks is not installed.

Install it before your first commit:

```bash
# macOS
brew install gitleaks

# Windows (scoop)
scoop install gitleaks

# Or download from: https://github.com/gitleaks/gitleaks/releases
```

In CI, `gitleaks/gitleaks-action` runs on every PR with `fetch-depth: 0` to scan the full commit history — not just the diff.

Configuration: `.gitleaks.toml` — allowlist for template placeholder patterns and example files.

---

## HTTP Security (Backend)

### Headers — `helmet`

`helmet()` is the first middleware in `api/app.ts`. It sets:

| Header                              | Value              | Protection                 |
| ----------------------------------- | ------------------ | -------------------------- |
| `X-Content-Type-Options`            | `nosniff`          | MIME-type sniffing         |
| `X-Frame-Options`                   | `SAMEORIGIN`       | Clickjacking               |
| `X-DNS-Prefetch-Control`            | `off`              | DNS prefetch leakage       |
| `Strict-Transport-Security`         | `max-age=15552000` | Downgrade attacks          |
| `Referrer-Policy`                   | `no-referrer`      | Referrer leakage           |
| `X-Download-Options`                | `noopen`           | IE download exploit        |
| `X-Permitted-Cross-Domain-Policies` | `none`             | Flash/Acrobat cross-domain |

### CORS

```typescript
app.use(cors({ origin: process.env.CORS_ORIGIN ?? false }));
```

`false` is the default — all cross-origin requests are denied unless `CORS_ORIGIN` is explicitly set. Set it in `backend/.env` / Cloud Functions environment config:

```bash
CORS_ORIGIN=https://your-app.web.app
```

Do not set `CORS_ORIGIN=*` in production.

### Rate Limiting

Global limiter: 300 requests per 15 minutes per IP address. Responses use RFC 9457 format with `status: 429`.

Add per-endpoint tighter limits on sensitive operations (auth flows, writes):

```typescript
import rateLimit from "express-rate-limit";

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/sensitive-action", strictLimiter, handler);
```

### Body Size

Request body is capped at `1mb` (`express.json({ limit: '1mb' })`). Routes that accept file uploads must handle their own higher limit on the specific route only — do not raise the global limit.

---

## HTTP Security (Frontend)

The frontend is a static export served by Firebase Hosting. Security headers are set in `firebase.json` under `hosting.headers` for all routes:

| Header                   | Value                                                         |
| ------------------------ | ------------------------------------------------------------- |
| `X-Content-Type-Options` | `nosniff`                                                     |
| `X-Frame-Options`        | `DENY`                                                        |
| `Referrer-Policy`        | `strict-origin-when-cross-origin`                             |
| `Permissions-Policy`     | camera, microphone, geolocation, browsing-topics all disabled |

**Content Security Policy (CSP)** is an opt-in per project — it requires a tuned `script-src` per project's third-party scripts. Add it as a header in `firebase.json` when ready.

---

## Authentication

### Backend token flow

```
Client → Authorization: Bearer <Firebase ID token>
         ↓
authMiddleware → tokenVerifier.verify(token) → Actor { uid, email, claims }
                 ↓
Route handler → (req as AuthenticatedRequest).actor.uid
```

- Tokens expire after 1 hour — the client SDK auto-refreshes via `getIdToken()`
- The `TokenVerifier` interface is injected — swap `firebaseTokenVerifier` in tests without touching Firebase
- Invalid or expired tokens always return `401 Unauthorized` with RFC 9457 format

### Frontend auth flow

```
Sign in (Firebase client SDK) → onAuthStateChanged fires in AuthProvider
                                 ↓
                       Every apiFetch call:
                         user.getIdToken() → Authorization: Bearer <token>
                                 ↓
                       Backend authMiddleware verifies per request
```

- ID tokens expire after 1 hour; the Firebase client SDK refreshes them automatically
- There is **no session cookie**; all server-side trust comes from verifying the ID token in `authMiddleware`
- Client-side route guards (`useRequireAuth`, `useRedirectIfAuthed`) only gate UX — they are not a security boundary

### Revoking sessions

To force-sign-out a user:

1. `adminAuth.revokeRefreshTokens(uid)` — revokes all tokens
2. Backend `authMiddleware` must call `adminAuth.verifyIdToken(token, true)` with `checkRevoked: true` to reject revoked tokens on the next request
3. On the client, `onAuthStateChanged` receives `null` after token refresh fails

---

## Input Validation

All route handlers validate `req.body` with Zod before use. Use `.strict()` to reject unknown fields (prevents mass assignment):

```typescript
const schema = z
  .object({
    title: z.string().min(1).max(200),
    content: z.string().min(1),
  })
  .strict(); // rejects any fields not listed above

const parsed = schema.safeParse(req.body);
if (!parsed.success) {
  return next(
    new ApiError(
      400,
      "Bad Request",
      parsed.error.errors[0]?.message ?? "Invalid input",
    ),
  );
}
// use parsed.data — fully typed, no unknown fields
```

Never access `req.body.field` directly without a preceding Zod parse.

---

## Error Handling

Errors use RFC 9457 Problem Details format — no stack traces, no internal details leak to the client:

```json
{
  "type": "https://httpstatuses.io/404",
  "title": "Not Found",
  "status": 404,
  "detail": "User 'abc' not found"
}
```

- `DomainError` subclasses (no HTTP awareness) are mapped to `ApiError` at the `api/` boundary
- Unknown errors log server-side and return `500` with a generic message — never expose stack traces
- `console.error` (not `console.log`) is used for error logging — architecture tests block `console.log`

---

## Firestore Security Rules

Rules in `docker/firebase-emulator/firebase/firestore.rules` are the **first line of defence at the database boundary**. The public Firebase web config (project ID + API key) ships in the frontend bundle, so `firestore.googleapis.com` is reachable by any holder of a valid Firebase ID token regardless of what the frontend does. Anything we allow in rules is allowed for the entire internet of authenticated tokens.

### Policy: default-deny everything

Internbot's posture is **all data access goes through the backend Express API**. The Admin SDK in Cloud Functions bypasses Firestore rules, and the API layer applies DTO redaction (drops auth provider IDs, raw GPA, phone, etc.) that the rules language cannot express. The client SDK is never granted read or write access to any collection.

```javascript
match /{document=**} {
  allow read, write: if false;
}
```

The frontend bundle correspondingly does **not** initialise `getFirestore()` — there is no client-SDK Firestore surface to misuse. Realtime UX (live listeners) is intentionally not supported on the client; if a feature genuinely needs it, that is a deliberate architectural change and should be discussed before relaxing this default-deny posture.

### Adding a new collection

Do **not** add an `allow` rule. Expose the collection through a backend route (handler → application command → repository → admin SDK) and apply DTO redaction on the response.

### Deploying rules

```bash
firebase deploy --config docker/firebase-emulator/firebase.json --only firestore:rules
```

Never deploy rules from a local machine in production — use the CI deploy workflow.

---

## Firebase Service Account (backend only)

The backend uses Application Default Credentials when deployed to Cloud Functions — no service account JSON key is stored in CI or the repo. The frontend package does **not** import `firebase-admin` and has no access to any service account.

**Rules:**

- Never use a `NEXT_PUBLIC_` prefix on any service account or admin key
- Cloud Functions pick up the runtime service account automatically
- For local emulator dev, the backend uses the emulator's built-in fake credentials

**Production hardening (GCP Secret Manager):** use `defineSecret()` for runtime secrets (see [docs/ENV-VARS.md](./ENV-VARS.md)). Never fetch service account keys from Secret Manager at cold start — use ADC instead.

---

## Environment Variables

| Classification            | Rule                                                           |
| ------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_*`           | Safe for the browser — Firebase client config only             |
| Server secrets            | Never use `NEXT_PUBLIC_` prefix — enforced by Claude Code hook |
| `.env.local` / `.env`     | Gitignored — never commit                                      |
| `.env.example`            | Committed with empty values — safe                             |
| `*.pem`, `*.p12`, `*.key` | Blocked from Claude Code reads via `permissions.deny`          |

---

## Dependency Scanning

`pnpm audit --audit-level=high` runs on every PR in CI (`security` job in `ci.yml`). The job fails on any high or critical CVE, blocking the merge.

```bash
# Run locally
pnpm audit --audit-level=high

# Auto-fix where safe
pnpm audit --fix
```

Dependabot opens weekly PRs for outdated packages from the repository root pnpm workspace and GitHub Actions workflows (`.github/dependabot.yml`). The npm update block intentionally points at `/` so Dependabot updates package manifests and the shared `pnpm-lock.yaml` together.

---

## Claude Code Security Hooks

The `.claude/settings.json` hooks enforce security patterns automatically:

| Hook                         | What it blocks                                                                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `permissions.deny`           | `rm -rf`, force push, `--no-verify`, `npm`/`yarn`, `curl \| bash`, `wget \| bash`, reading `~/.ssh/**`, `~/.aws/**`, `*.pem`, `*.p12`, `*.key` |
| PostToolUse — `any` block    | TypeScript `any` in all forms: `: any`, `as any`, `any[]`, `Promise<any>`, `Record<string, any>`                                               |
| PostToolUse — secret prefix  | `NEXT_PUBLIC_` on service accounts, admin keys, or private keys                                                                                |
| PostToolUse — env files      | Blocks writing `.env.local`, `.env.production`, `.env.staging` (only `.env.example` is safe)                                                   |
| PostToolUse — admin.ts       | Blocks `'use client'` in `lib/firebase/admin.ts`                                                                                               |
| PreToolUse — firebase deploy | Blocks `firebase deploy` — requires explicit user approval                                                                                     |
| PreToolUse — git push        | Blocks direct pushes to `main` or `develop`                                                                                                    |

---

## Opt-In Security Hardening (Per Client)

These are not enabled by default because they require per-project configuration:

### Firebase App Check

Prevents non-app clients (curl, scanners) from calling the API:

```typescript
// backend/src/index.ts
export const api = onRequest(
  { enforceAppCheck: true, consumeAppCheckToken: true, ... },
  app
)
```

Requires App Check initialization in the frontend Firebase SDK. Document the setup steps before enabling on a client project.

### Content Security Policy

Blocks XSS by restricting which scripts can execute. Requires nonce injection in `proxy.ts` — see the Next.js CSP guide. The `script-src` directive must be tuned to each project's third-party scripts (Google Analytics, Intercom, etc.).

### GCP Secret Manager

Replaces environment variable secrets with Secret Manager references. Recommended for projects with strict compliance requirements (SOC 2, ISO 27001, healthcare).

### Email Enumeration Protection

Enable in Firebase Auth: Authentication → Settings → Email enumeration protection. Returns generic errors for sign-in attempts on non-existent accounts (prevents user discovery).

### Firestore Field-Level Validation

Add `request.resource.data.size() == N` and field-type checks on write rules for collections that store sensitive data:

```javascript
allow create: if request.resource.data.keys().hasOnly(['title', 'uid', '_schemaVersion'])
  && request.resource.data.title is string
  && request.resource.data.title.size() <= 200;
```
