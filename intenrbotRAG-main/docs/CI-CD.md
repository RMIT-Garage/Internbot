# CI/CD

## Pipeline Overview

```
PR opened/updated
    │
    ▼
CI (ci.yml)
├── Lint + Typecheck
├── Frontend unit tests
├── Backend unit tests
└── Security scan (gitleaks + pnpm audit --audit-level=high)
    │
    ▼ (all green)
Merge to main
    │
    ▼
Deploy (deploy.yml)
├── Build frontend (next build with Firebase env vars)
├── Build backend (tsc)
├── Authenticate via GOOGLE_APPLICATION_CREDENTIALS
└── firebase deploy --only hosting,functions,firestore:rules,storage
```

## GitHub Actions Secrets Required

Add these in **GitHub → Settings → Secrets and variables → Actions**:

### Frontend build secrets

| Secret                                     | Description                           |
| ------------------------------------------ | ------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase web API key                  |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | `<project>.firebaseapp.com`           |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project ID                   |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | `<project>.appspot.com`               |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging sender ID             |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase app ID                       |
| `NEXT_PUBLIC_APP_NAME`                     | App display name shown in browser tab |

### Deploy secrets

| Secret                                | Description                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`                 | Firebase project ID (used as `--project` flag)                                                 |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | Base64-encoded service account JSON — used for both deploy auth and the backend Cloud Function |

### RAG runtime secrets (required for live FAQ / ingest in production)

Written to `backend/.env.<FIREBASE_PROJECT_ID>` during deploy by `.github/workflows/deploy-firebase.yml`:

| Secret                      | Description                         |
| --------------------------- | ----------------------------------- |
| `GEMINI_API_KEY`            | Gemini chat + embeddings            |
| `SUPABASE_URL`              | Supabase project URL                |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server only) |

See [HANDOVER.md](./HANDOVER.md) for the full onboarding checklist.

### Getting the service account key

1. Firebase Console → Project Settings → Service Accounts
2. Click **Generate new private key** → download the JSON file
3. Encode it:

```bash
# macOS / Linux
base64 -w 0 service-account.json

# Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
```

4. Add the output as `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` in GitHub secrets.

> **Note:** `firebase login:ci` tokens are deprecated. This project uses `GOOGLE_APPLICATION_CREDENTIALS` via the service account key, which is the current recommended approach.

## Manual Deployment

```bash
# Authenticate locally (one-time)
firebase login

# Deploy everything
firebase deploy --project your-project-id

# Deploy specific targets
firebase deploy --only hosting
firebase deploy --only functions
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## Environments

| Environment | Branch               | Auto-deploy         |
| ----------- | -------------------- | ------------------- |
| Production  | `main`               | Yes, on push        |
| Staging     | _set up per project_ | Optional            |
| Local       | emulators (Docker)   | `pnpm run emulator` |
