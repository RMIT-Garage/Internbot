# interbotRAG — Handover guide

Step-by-step guide for deploying **interbotRAG** on a **new** Firebase + Supabase account and connecting it to **[Internbot](https://github.com/giatinhuynh/Internbot)**.

**Maintainer:** Duc Gia Tin Huynh (s3962053)

| Repo                        | Role                                                     |
| --------------------------- | -------------------------------------------------------- |
| **interbotRAG** (this repo) | RAG API, knowledge ingest, demo/admin UI                 |
| **Internbot**               | Main app; proxies advisor/checkers via `RAG_SERVICE_URL` |

---

## 0. Before you start

### Access you need

- [ ] GitHub: admin on **interbotRAG** (and **Internbot** for wiring `RAG_SERVICE_URL`)
- [ ] Firebase / GCP project (one project is enough for capstone; add staging if you want)
- [ ] [Supabase](https://supabase.com) project with **pgvector** enabled
- [ ] Google AI Studio / GCP billing for **Gemini API**

### Tools

- Node.js 22, pnpm 10, Docker Desktop
- `firebase-tools` CLI
- Supabase CLI (optional; repo script uses `npx supabase`)

### Deploy order

Deploy **interbotRAG before** (or at least before testing FAQ in Internbot). Internbot only needs your function **base URL** after RAG is live.

**Branch model:** CI deploys on push to **`main` only**. One Firebase project can serve both Internbot dev and prod; use separate RAG projects only if you need isolated knowledge bases.

---

## Day 1 timeline (interbotRAG)

| Step | Action                                                                      | Done |
| ---- | --------------------------------------------------------------------------- | ---- |
| 1    | Create Firebase project + enable Auth, Firestore, Storage                   | [ ]  |
| 2    | Create Supabase project; enable pgvector                                    | [ ]  |
| 3    | Link Supabase CLI + apply schema (§2)                                       | [ ]  |
| 4    | Create Gemini API key                                                       | [ ]  |
| 5    | Set `.firebaserc` + all GitHub secrets (§4)                                 | [ ]  |
| 6    | Manual deploy (§5) **or** push to `main` for CI                             | [ ]  |
| 7    | `ingest:knowledge`; verify `/assistant?feature=faq-rag`                     | [ ]  |
| 8    | Copy function base URL into Internbot `rag_service_url` / `RAG_SERVICE_URL` | [ ]  |

---

## Canonical URLs

Set `PUBLIC_API_BASE_URL` in backend env to the **function base** (optional; improves OpenAPI `servers`).

| Use                                        | Example (replace `{project}`)                                          |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| **API base** (Internbot `RAG_SERVICE_URL`) | `https://australia-southeast1-{project}.cloudfunctions.net/api`        |
| Health                                     | `https://australia-southeast1-{project}.cloudfunctions.net/api/health` |
| Swagger UI                                 | `https://australia-southeast1-{project}.cloudfunctions.net/api/docs`   |
| Chat (legacy, Internbot proxy)             | `POST {base}/api/chat/message`                                         |
| Demo UI                                    | `https://{project}.web.app`                                            |

Outgoing capstone example base: `https://australia-southeast1-internbotrag.cloudfunctions.net/api`

On the Cloud Function URL, use `{base}/api/health` (the function name is `api`, so `{base}` already includes that segment).

---

## Credentials inventory

| Credential                                  | Store in                                   | Used for                            |
| ------------------------------------------- | ------------------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_FIREBASE_*`                    | GitHub Actions secrets                     | CI frontend build                   |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`       | GitHub secret                              | CI `GOOGLE_APPLICATION_CREDENTIALS` |
| `FIREBASE_PROJECT_ID`                       | GitHub secret                              | Deploy `--project`                  |
| `GEMINI_API_KEY`                            | GitHub secret → `backend/.env.<projectId>` | Chat + embeddings                   |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | GitHub secrets → backend env               | Retrieval + ingest                  |
| `ibk_*` keys (optional)                     | Issued via CLI; hash in Firestore          | `/api/v1/*`                         |
| Local                                       | `backend/.env`, `frontend/.env.local`      | Dev / manual deploy                 |

Never commit service account JSON, Supabase service role, or Gemini keys.

---

## 1. Create the Firebase / GCP project

1. Create a Firebase project, e.g. `your-org-internbotrag`.
2. Enable **Authentication** (Email/Password + Google if using demo UI).
3. Create **Firestore** and enable **Storage**.
4. Register a **Web app** → copy `firebaseConfig` values for GitHub secrets / `.env.local`.
5. **Project settings → Service accounts → Generate new private key** → base64 for deploy (see § 4).

Set **`.firebaserc`** at repo root:

```json
{
  "projects": {
    "default": "your-org-internbotrag"
  }
}
```

Region for functions: **`australia-southeast1`** (see `backend/src/index.ts`).

---

## 2. Create Supabase (knowledge / vectors)

1. Create a Supabase project in a region close to `australia-southeast1`.
2. Enable the **vector** extension if prompted (Dashboard → Database → Extensions → `vector`).
3. Apply schema — **option A (CLI):**

```bash
cd interbotRAG
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF   # Settings → General → Reference ID
pnpm run supabase:schema
```

**Option B:** Supabase Dashboard → SQL → New query → paste `backend/supabase/schema.sql` → Run.

Creates `knowledge_documents`, `knowledge_chunks`, and `match_knowledge_chunks` RPC.

4. Save **Project URL** and **service role key** (Settings → API) — never commit the service role key.

---

## 3. Gemini API key

1. Create an API key in [Google AI Studio](https://aistudio.google.com/apikey) or GCP.
2. Store it securely — used for embeddings and chat generation.

---

## 4. GitHub Actions secrets (CI deploy)

Workflow: `.github/workflows/deploy-firebase.yml` (runs on push to **`main`**).

Add in **GitHub → Settings → Secrets and variables → Actions**:

### Firebase deploy

| Secret                                | Description                           |
| ------------------------------------- | ------------------------------------- |
| `FIREBASE_PROJECT_ID`                 | e.g. `your-org-internbotrag`          |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | Base64 of deploy service account JSON |

```bash
base64 -w 0 service-account.json   # macOS/Linux
```

Grant the service account at least: **Firebase Admin**, **Cloud Functions Admin**, **Service Account User**, roles needed for Hosting deploy.

### Frontend build (`NEXT_PUBLIC_*`)

| Secret                                     | Description        |
| ------------------------------------------ | ------------------ |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Web app config     |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         |                    |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          |                    |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      |                    |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` |                    |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              |                    |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`      | Optional           |
| `NEXT_PUBLIC_APP_NAME`                     | e.g. `interbotRAG` |

### RAG runtime (required for live FAQ)

| Secret                      | Description                    |
| --------------------------- | ------------------------------ |
| `GEMINI_API_KEY`            | Gemini generation + embeddings |
| `SUPABASE_URL`              | `https://xxxx.supabase.co`     |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only)     |

The deploy workflow writes these into `backend/.env.<FIREBASE_PROJECT_ID>` before `firebase deploy` so Cloud Functions receive them at runtime.

---

## 5. Manual first deploy (alternative to CI)

Useful to validate before enabling GitHub Actions.

```bash
git clone https://github.com/giatinhuynh/interbotRAG.git
cd interbotRAG
pnpm install

# frontend
cp frontend/.env.example frontend/.env.local
# fill NEXT_PUBLIC_* and FIREBASE_SERVICE_ACCOUNT_KEY_BASE64 if using server routes

# backend — project-specific env file (gitignored pattern: backend/.env*)
cat > backend/.env.your-org-internbotrag <<'EOF'
FIREBASE_PROJECT_ID=your-org-internbotrag
GEMINI_API_KEY=your-key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_EMBEDDING_MODEL=text-embedding-004
EOF

pnpm --filter backend build
firebase login
firebase deploy --project your-org-internbotrag --only functions,hosting,firestore:rules,storage
```

Note your deployed API URL:

```text
https://australia-southeast1-your-org-internbotrag.cloudfunctions.net/api
```

---

## 6. Seed knowledge (FAQ for Internbot)

With `backend/.env` or `backend/.env.<projectId>` containing Supabase + Gemini keys:

```bash
# Optional: refresh scraped RMIT pages
pnpm --filter backend scrape:rmit-pages

# Ingest bundled FAQ, coordinators, manifest entries
pnpm --filter backend ingest:knowledge -- --replace-feature faq-rag
```

Verify in the demo UI: `/assistant?feature=faq-rag` → answer includes **sources**.

Playbook detail: [RAG-SETUP-PLAYBOOK.md](./RAG-SETUP-PLAYBOOK.md).

### Admin claim (knowledge API)

For `POST /api/knowledge/documents`, the Firebase user needs custom claim `{ "admin": true }`.

```bash
pnpm run grant-admin   # emulator only — grants admin to all emulator users
```

**Production** — run once with a service account (same JSON as deploy SA), from repo root:

```bash
# Set GOOGLE_APPLICATION_CREDENTIALS to your service account JSON
node -e "
const admin = require('./backend/node_modules/firebase-admin');
admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
admin.auth().getUserByEmail('your-admin@example.com')
  .then(u => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log('admin claim set'))
  .catch(console.error);
"
```

User must sign out and sign in again for claims to refresh.

---

## 7. Issue API keys (optional, for `/api/v1/*`)

Internbot’s current proxy uses legacy **`POST /api/chat/message`** (no `ibk_*` key). Use v1 keys if you integrate server-to-server with auth:

```bash
pnpm --filter backend keys:issue -- --label "internbot-dev" --env live
```

Store the plaintext key once; Internbot would send `Authorization: Bearer ibk_live_...` only from **server** code.

See [PUBLIC_API.md](./PUBLIC_API.md).

---

## 8. Connect Internbot

In the **Internbot** repository:

1. Open `.github/workflows/deploy-dev.yml` and `deploy-prod.yml`.
2. Set `rag_service_url` to your RAG base URL (same as § 5), e.g.  
   `https://australia-southeast1-your-org-internbotrag.cloudfunctions.net/api`
3. For local Internbot dev, set the same value in `backend/.env` as `RAG_SERVICE_URL`.
4. Deploy Internbot functions (push `develop` or manual deploy).
5. Smoke test from Internbot UI: student **Advisor / FAQ** and checkers.

Full Internbot steps: [Internbot docs/HANDOVER.md](https://github.com/giatinhuynh/Internbot/blob/main/docs/HANDOVER.md).

---

## 9. Verification checklist

### Deploy

- [ ] `GET https://australia-southeast1-{project}.cloudfunctions.net/api/health` returns OK
- [ ] Swagger: `GET .../api/docs` loads
- [ ] Demo site loads at Firebase Hosting URL

### RAG

- [ ] `ingest:knowledge` completed without errors
- [ ] `/assistant?feature=faq-rag` returns reply + `sources`
- [ ] `job-checker` and `contract-checker` features respond (see sample cases in `docs/samples/`)

### Internbot integration

- [ ] Internbot `RAG_SERVICE_URL` matches your function base
- [ ] Internbot advisor chat returns 200 (not 503 Service Unavailable)

### CI

- [ ] Push to `main` runs `deploy-firebase.yml` successfully
- [ ] GitHub secrets include `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 10. Local development

```bash
pnpm run bootstrap
# .firebaserc + backend/.env + frontend/.env.local
pnpm run dev
```

Emulator UI: [http://localhost:4000](http://localhost:4000). App: [http://localhost:3000](http://localhost:3000).

RAG requires real Supabase + Gemini even locally if you want retrieval (not emulated).

---

## Post-deploy operations

- **Re-ingest FAQ** after changing `backend/data/*.txt` or manifest:  
  `pnpm --filter backend ingest:knowledge -- --replace-feature faq-rag`
- **Rotate Gemini or Supabase keys** → update GitHub secrets and redeploy (or update `backend/.env.<projectId>` + manual deploy).
- **Internbot** must redeploy functions after you change the RAG function URL.

---

## Troubleshooting

| Symptom                             | Likely cause                              | What to do                                                                                         |
| ----------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Deploy fails: missing base64 secret | GitHub secret empty or malformed          | Re-encode SA JSON; no newlines in secret                                                           |
| Chat works but **no sources**       | Supabase empty or env missing on function | Run ingest; verify `GEMINI_*` + `SUPABASE_*` in deployed env                                       |
| Ingest fails on embeddings          | Invalid `GEMINI_API_KEY` or quota         | AI Studio quotas; check model names in `.env`                                                      |
| `supabase:schema` fails             | Project not linked                        | `supabase link --project-ref …`                                                                    |
| `/knowledge` API 403                | No `{ admin: true }` claim                | §6 admin claim                                                                                     |
| Internbot advisor **503**           | Wrong `RAG_SERVICE_URL`                   | Use function base ending in `/api`                                                                 |
| CI deploy OK but runtime empty env  | Secrets not in workflow before deploy     | Confirm `GEMINI_API_KEY`, `SUPABASE_*` in GitHub; check deploy log for “Write backend runtime env” |
| `webframeworks` experiment error    | Hosting framework deploy                  | Workflow runs `firebase experiments:enable webframeworks`                                          |

---

## 11. CI/CD summary

| Trigger        | Workflow              | Action                                          |
| -------------- | --------------------- | ----------------------------------------------- |
| Push to `main` | `deploy-firebase.yml` | Build FE/BE, deploy hosting + functions + rules |

Unlike Internbot, this repo uses **GitHub Secrets** (service account base64), not OIDC/WIF.

Details: [CI-CD.md](./CI-CD.md).

---

## 12. Costs and quotas

- **Gemini** — embedding + generation per chat/ingest; monitor AI Studio quotas.
- **Supabase** — storage and vector queries; stay within free tier or plan limits.
- **Cloud Functions** — cold starts on `api`; `maxInstances: 10` in code.

---

## 13. Human handoff checklist

- [ ] GitHub repo access
- [ ] Firebase/GCP project + Supabase project ownership
- [ ] Gemini API key under your account
- [ ] GitHub Actions secrets documented in a password manager
- [ ] Internbot team has the RAG base URL and ingest was run on your Supabase

---

## 14. Reference docs

| Topic              | Document                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| README             | [../README.md](../README.md)                                                                      |
| RAG setup          | [RAG-SETUP-PLAYBOOK.md](./RAG-SETUP-PLAYBOOK.md)                                                  |
| RAG MVP scope      | [RAG-MVP.md](./RAG-MVP.md)                                                                        |
| Public API v1      | [PUBLIC_API.md](./PUBLIC_API.md)                                                                  |
| Env vars           | [ENV-VARS.md](./ENV-VARS.md)                                                                      |
| Internbot handover | [Internbot docs/HANDOVER.md](https://github.com/giatinhuynh/Internbot/blob/main/docs/HANDOVER.md) |

---

## 15. Outgoing reference (capstone)

| Item                   | Value                                                              |
| ---------------------- | ------------------------------------------------------------------ |
| Example production URL | `https://australia-southeast1-internbotrag.cloudfunctions.net/api` |
| Repo                   | https://github.com/giatinhuynh/interbotRAG                         |

Replace with your project ids and URLs before go-live.
