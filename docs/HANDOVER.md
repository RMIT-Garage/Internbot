# Internbot — Handover guide

Step-by-step guide for a new team taking over **Internbot** on **their own** GCP/Firebase account. Complete **interbotRAG** first (or in parallel) — see [interbotRAG `docs/HANDOVER.md`](https://github.com/giatinhuynh/interbotRAG/blob/main/docs/HANDOVER.md).

| Repo                      | Role                                                        |
| ------------------------- | ----------------------------------------------------------- |
| **Internbot** (this repo) | Student/coordinator app, workflow API, Hosting              |
| **interbotRAG**           | FAQ RAG + job/contract checkers (separate Firebase project) |

---

## 0. Before you start

### Access you need

- [ ] GitHub: admin on the **Internbot** repository (and **interbotRAG**)
- [ ] GCP: ability to create projects and link billing
- [ ] Firebase Console access on those projects
- [ ] Supabase account (for interbotRAG knowledge base)
- [ ] Gemini API access (for interbotRAG)

### Tools on your laptop

- Node.js 22, pnpm 10, Docker Desktop
- `gcloud` CLI (authenticated)
- `firebase-tools` CLI
- Terraform ≥ 1.10 (for infra apply / debugging)
- `gitleaks` (pre-commit)

### Recommended deploy order

```text
1. interbotRAG  → Firebase project + Supabase + ingest FAQ
2. Internbot dev → Terraform + CI deploy develop
3. Wire RAG_SERVICE_URL in Internbot to your RAG URL
4. Internbot prod → merge to main when ready
```

---

## Day 1 timeline (full stack)

Use this as a single-day checklist. **Do not enable CI deploy until §3.2 workflow values exist** (first Terraform apply must be local, or the first `deploy-dev` run will fail OIDC).

| Step | Owner repo  | Action                                                                                               | Done |
| ---- | ----------- | ---------------------------------------------------------------------------------------------------- | ---- |
| 1    | interbotRAG | Create Firebase + Supabase + Gemini key                                                              | [ ]  |
| 2    | interbotRAG | Apply `backend/supabase/schema.sql`, set GitHub secrets, deploy (manual or push `main`)              | [ ]  |
| 3    | interbotRAG | Run `ingest:knowledge`, note **RAG base URL** (ends with `/api`)                                     | [ ]  |
| 4    | Internbot   | Create dev (+ prod) GCP projects, bootstrap tf-state + `terraform-ci` (§2)                           | [ ]  |
| 5    | Internbot   | Update `tfvars` + `deploy-*.yml` placeholders (§3); **leave `wire_blocking_function = false` first** | [ ]  |
| 6    | Internbot   | `terraform apply` locally for **dev**; capture `wif_provider`, `hosting_url` (§4)                    | [ ]  |
| 7    | Internbot   | Paste Terraform outputs into `deploy-dev.yml`; set `rag_service_url` to step 3 URL                   | [ ]  |
| 8    | Internbot   | Push to `develop` → CI + deploy (functions + hosting)                                                | [ ]  |
| 9    | Internbot   | Deploy functions once; if using blocking email gate, complete §6 then re-apply Terraform             | [ ]  |
| 10   | Internbot   | Provision coordinator + run dev seed (§Post-deploy)                                                  | [ ]  |
| 11   | Both        | Run verification checklists (§9 + interbotRAG §9)                                                    | [ ]  |
| 12   | Internbot   | Repeat 4–8 for **prod** when ready (`main` / `deploy-prod.yml`)                                      | [ ]  |

**Billing account id** (for `infrastructure/envs/*.tfvars`):

```bash
gcloud billing accounts list
# Copy ACCOUNT_ID from the row linked to your org
```

**GitHub repo id** (only if you fork — for Terraform WIF):

```bash
gh api repos/OWNER/REPO --jq .id
```

---

## Canonical URLs

Replace placeholders with your project ids. Hosting URLs come from `terraform output hosting_url` after apply.

### interbotRAG (one Firebase project is enough for capstone)

| Use                                                   | URL pattern                                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| Cloud Function API base (Internbot `RAG_SERVICE_URL`) | `https://australia-southeast1-{rag-project}.cloudfunctions.net/api` |
| Health (direct on function)                           | `{base}/api/health`                                                 |
| OpenAPI / Swagger                                     | `{base}/api/docs`                                                   |
| Demo UI (Hosting)                                     | `https://{rag-project}.web.app`                                     |

Outgoing example: `https://australia-southeast1-internbotrag.cloudfunctions.net/api`

### Internbot dev

| Use                              | URL pattern                                                                |
| -------------------------------- | -------------------------------------------------------------------------- |
| App (Hosting)                    | `https://{dev-project}.web.app`                                            |
| API health (via Hosting rewrite) | `https://{dev-project}.web.app/api/health`                                 |
| API health (function direct)     | `https://australia-southeast1-{dev-project}.cloudfunctions.net/api/health` |
| OpenAPI                          | `https://{dev-project}.web.app/api/openapi.json`                           |

Outgoing example app: `https://internbot-dev-ae3a3.web.app`

### Internbot prod

Same patterns with `{prod-project}` (e.g. `internbot-prod`).

**Internbot dev + prod can share one interbotRAG URL** unless you stand up separate RAG projects per environment.

---

## Credentials inventory

Where each secret lives — **never commit values**.

### interbotRAG

| Credential                                  | Store in                                             | Used for                   |
| ------------------------------------------- | ---------------------------------------------------- | -------------------------- |
| Firebase web `NEXT_PUBLIC_*`                | GitHub Actions secrets                               | CI frontend build          |
| Service account JSON (base64)               | GitHub secret `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`  | CI deploy auth             |
| `GEMINI_API_KEY`                            | GitHub secret → `backend/.env.<projectId>` at deploy | Embeddings + chat          |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | GitHub secrets → backend env at deploy               | Vector retrieval           |
| `ibk_*` API keys (optional)                 | Firestore `api_keys` (hash only stored)              | `/api/v1/*` server clients |
| Local dev                                   | `backend/.env`, `frontend/.env.local`                | Emulators / manual deploy  |

### Internbot

| Credential                        | Store in                                                                       | Used for                                               |
| --------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| Firebase web config JSON          | Secret Manager `firebase-web-config` (Terraform)                               | CI hosting build (`NEXT_PUBLIC_*`)                     |
| Deploy / Terraform                | **No JSON in GitHub** — OIDC impersonates `github-deploy@…` / `terraform-ci@…` | CI deploy + Terraform                                  |
| `RAG_SERVICE_URL`                 | `deploy-*.yml` → `backend/.env.<projectId>` at deploy                          | Advisor proxy                                          |
| `RAG_API_KEY` (optional)          | `firebase functions:secrets:set`                                               | Only if you add Bearer auth to proxy                   |
| Runtime secrets (`defineSecret`)  | Secret Manager via Firebase CLI                                                | Per secret name in `backend/src/index.ts`              |
| Local emulator secrets            | `backend/.secret.local` (gitignored)                                           | `pnpm run dev`                                         |
| Local non-secret                  | `backend/.env`, `frontend/.env.local`                                          | Emulators                                              |
| Dev-only `AUTO_VERIFY_EMAIL=true` | `backend/.env` **dev only**                                                    | Skips email verification round-trip (see §Post-deploy) |
| Coordinator / student passwords   | Team password manager                                                          | `backend/scripts/seed.ts` only                         |

**Handoff from outgoing team:** rotate all of the above under your GCP org; do not reuse their service account keys or Supabase service role.

---

## 1. Create GCP / Firebase projects (Internbot)

Create **two** Firebase projects (dev + prod), e.g.:

| Environment | Example project id        | Git branch |
| ----------- | ------------------------- | ---------- |
| Dev         | `your-org-internbot-dev`  | `develop`  |
| Prod        | `your-org-internbot-prod` | `main`     |

For each project in [Firebase Console](https://console.firebase.google.com):

1. Create project (same id as GCP project id).
2. Enable **Authentication** → Email/Password (and Google if you use it).
3. Create **Firestore** (production mode; rules come from Terraform).
4. Enable **Storage**.
5. Note the **project number** (GCP Console → Project settings) — needed for workflow WIF strings.

Region used in code: **`australia-southeast1`**.

---

## 2. Bootstrap Terraform state (per project, once)

Terraform state buckets and the `terraform-ci` service account are **not** in Terraform (chicken-and-egg). Run once per project **before** the first `terraform apply`.

Replace `PROJECT_ID` with your dev or prod id.

```bash
export PROJECT_ID=your-org-internbot-dev
export REGION=australia-southeast1

# State bucket
gcloud storage buckets create gs://${PROJECT_ID}-tf-state \
  --project=$PROJECT_ID --location=$REGION \
  --uniform-bucket-level-access --public-access-prevention
gcloud storage buckets update gs://${PROJECT_ID}-tf-state \
  --versioning --project=$PROJECT_ID

# Terraform CI service account
gcloud iam service-accounts create terraform-ci \
  --project=$PROJECT_ID --display-name="Terraform CI"

for role in roles/editor roles/iam.securityAdmin roles/iam.workloadIdentityPoolAdmin \
            roles/iam.serviceAccountAdmin roles/resourcemanager.projectIamAdmin \
            roles/storage.admin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:terraform-ci@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role" --condition=None
done
```

Repeat for prod with `your-org-internbot-prod`.

Full reference: [INFRASTRUCTURE.md](./INFRASTRUCTURE.md#bootstrap--how-state-buckets-and-terraform-sas-were-created).

---

## 3. Update repository configuration

Commit these changes on a handover branch, then merge to `develop` / `main`.

### 3.1 Terraform env files

| File                              | Fields to change                                                       |
| --------------------------------- | ---------------------------------------------------------------------- |
| `infrastructure/envs/dev.tfvars`  | `project_id`, `state_bucket`, `billing_account`, `github_allowed_refs` |
| `infrastructure/envs/prod.tfvars` | Same for prod                                                          |

Example:

```hcl
project_id          = "your-org-internbot-dev"
state_bucket        = "your-org-internbot-dev-tf-state"
billing_account     = "YOUR-BILLING-ACCOUNT-ID"
github_allowed_refs = ["refs/heads/develop"]
```

Set `wire_blocking_function = false` on the **first** Terraform apply if `enforceStudentEmail` is not deployed yet; set `true` after the function exists (see [§ 6](#6-blocking-function-enforcestudentemail-optional-two-step)).

### 3.2 GitHub Actions deploy workflows

Update **both** `.github/workflows/deploy-dev.yml` and `deploy-prod.yml`:

| Input                    | What to set                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `state_bucket`           | `{project_id}-tf-state`                                                                                                         |
| `wif_provider`           | `projects/{PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/providers/github-provider`                             |
| `terraform_sa`           | `terraform-ci@{project_id}.iam.gserviceaccount.com`                                                                             |
| `firebase_project_id`    | Your project id                                                                                                                 |
| `deploy_service_account` | `github-deploy@{project_id}.iam.gserviceaccount.com`                                                                            |
| `rag_service_url`        | Your **interbotRAG** function base URL (no trailing slash), e.g. `https://australia-southeast1-your-rag.cloudfunctions.net/api` |

`PROJECT_NUMBER` and WIF provider path come from the first successful Terraform apply outputs (`terraform output wif_provider`) or GCP Console.

### 3.3 GitHub repository identity

Terraform binds OIDC to **`github.repository_id`**. Workflows already pass `${{ github.repository_id }}` — no change if you keep the same GitHub repo. If you **fork** to a new repo, update `github_repository` / `github_repository_id` in Terraform variables (see `infrastructure/variables.tf`) and re-apply so WIF trusts the new repo.

### 3.4 Import existing Firebase Web App (dev only)

If the dev project already has a web app from the Console, import it before apply — [INFRASTRUCTURE.md § Frontend build config](./INFRASTRUCTURE.md#frontend-build-config-secret-manager).

---

## 4. First Terraform apply (local or CI)

### Option A — Local (recommended for first time)

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars   # gitignored; optional overrides

terraform init -backend-config="bucket=your-org-internbot-dev-tf-state"
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

Capture outputs:

```bash
terraform output wif_provider
terraform output deploy_service_account
terraform output hosting_url
terraform output firebase_web_config_secret
```

Paste `wif_provider` and service account emails into `deploy-dev.yml`. Repeat for prod with `envs/prod.tfvars`.

### Option B — CI only

Merge handover config to `develop` **only after** §3.2 workflow inputs are filled from a successful local apply. Otherwise the deploy job cannot authenticate to GCP (WIF provider and SA emails are unknown until Terraform creates them).

---

## 5. Runtime secrets (Secret Manager / Firebase)

Internbot uses **OIDC for deploy** — no service account JSON in GitHub. Runtime secrets use Firebase Functions secrets where defined.

### 5.1 RAG (if using interbotRAG)

| Secret        | When needed                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `RAG_API_KEY` | Only if you add Bearer auth to the advisor proxy toward `/api/v1/*`. Legacy proxy uses `POST /api/chat/message` without a key today. |

```bash
echo -n "ibk_live_..." | firebase functions:secrets:set RAG_API_KEY \
  --project your-org-internbot-dev --data-file=-
```

Local emulator: `backend/.secret.local`.

### 5.2 Other secrets

Add any future `defineSecret()` values the same way — never put secrets in `backend/.env` (deployed as plaintext). See [ENV-VARS.md](./ENV-VARS.md).

### 5.3 Non-secret: `RAG_SERVICE_URL`

Set in CI via `rag_service_url` in deploy workflows (written to `backend/.env.<projectId>` at deploy). Local: `backend/.env`.

---

## 6. Blocking function `enforceStudentEmail` (optional two-step)

GCIP can call a blocking function before user create. Terraform wires it when `wire_blocking_function = true`.

1. First release: `wire_blocking_function = false` in tfvars → `terraform apply` → deploy functions.
2. Deploy includes `enforceStudentEmail` (see backend exports).
3. Set `wire_blocking_function = true` → `terraform apply` again.

Details in `infrastructure/envs/dev.tfvars` comments.

---

## 7. Deploy application code

### Automated (normal path)

| Branch    | Workflow          | Target       |
| --------- | ----------------- | ------------ |
| `develop` | `deploy-dev.yml`  | Dev project  |
| `main`    | `deploy-prod.yml` | Prod project |

Pipeline: **CI** → **terraform apply** → **functions** (if backend changed) + **hosting** (if frontend changed).

Frontend build reads `firebase-web-config` from Secret Manager (created by Terraform `web-app` module).

### Manual (debug / first deploy)

Use the **root** `firebase.json` (not `docker/firebase-emulator/firebase.json`). Authenticate with `firebase login` or Application Default Credentials.

**Functions:**

```bash
pnpm install
pnpm --filter backend build
# Optional: RAG URL for this project
echo "RAG_SERVICE_URL=https://australia-southeast1-your-rag.cloudfunctions.net/api" \
  >> backend/.env.your-org-internbot-dev
firebase deploy --only functions --project your-org-internbot-dev
```

**Hosting** (needs `firebase-web-config` from Secret Manager — created by Terraform):

```bash
# Fetch web config (after terraform apply)
gcloud secrets versions access latest \
  --secret=firebase-web-config --project=your-org-internbot-dev \
  | jq -r 'to_entries[] | "\(.key)=\(.value)"' > /tmp/web-config.env
set -a && source /tmp/web-config.env && set +a

pnpm --filter frontend build
firebase deploy --only hosting --project your-org-internbot-dev
```

CI does the same fetch in `.github/workflows/_deploy-hosting.yml`.

---

## 8. Connect interbotRAG

After interbotRAG is deployed:

1. Copy the RAG function base URL (ends with `/api`).
2. Set `rag_service_url` in `deploy-dev.yml` / `deploy-prod.yml` (§ 3.2).
3. Redeploy Internbot backend (push to `develop` or manual functions deploy).
4. Smoke test (signed-in student): open advisor / FAQ in the UI → expect 200, not 503.

Contract: `POST {RAG_SERVICE_URL}/api/chat/message` with `feature: "faq-rag" | "job-checker" | "contract-checker"`.

---

## 9. Verification checklist

### Infrastructure

- [ ] `terraform output hosting_url` loads the static app
- [ ] `GET {hosting_url}/api/health` (or health route per OpenAPI) returns OK
- [ ] Firebase Auth sign-up / sign-in works on hosted URL
- [ ] Firestore rules deployed (Terraform); client cannot read Firestore directly

### Workflow

- [ ] Student can complete onboarding and select a semester
- [ ] Coordinator routes require coordinator role
- [ ] File upload / attachment flow hits Storage + API

### AI (with RAG)

- [ ] `RAG_SERVICE_URL` set on deployed `api` function (GCP Console → Functions → Environment variables)
- [ ] FAQ advisor returns an answer with sources (when RAG knowledge is seeded)

### CI

- [ ] PR to `develop` runs `ci.yml`
- [ ] Push to `develop` completes `deploy-dev.yml` without OIDC errors

---

## 10. Local development (new team)

```bash
git clone https://github.com/giatinhuynh/Internbot.git
cd Internbot
pnpm run bootstrap
# Edit frontend/.env.local and backend/.env — emulators on by default
pnpm run dev
```

Point `RAG_SERVICE_URL` at local interbotRAG emulator or your dev RAG URL. See [README](../README.md).

---

## Post-deploy operations

### Firebase Auth authorized domains

Terraform always allows `localhost`, `{project}.firebaseapp.com`, and `{project}.web.app`. If you use a **custom hostname**, add it to `extra_authorized_domains` in `infrastructure/envs/{dev,prod}.tfvars`, then `terraform apply`:

```hcl
extra_authorized_domains = ["your-custom-domain.example.com"]
```

### Dev-only: skip student email verification

On **dev only**, you may set `AUTO_VERIFY_EMAIL=true` in the function runtime env (via deploy dotenv or GCP Console) so testers skip the verification-email step. **Never enable on prod** — it weakens the student-number squatting gate. See `backend/.env.example`.

### Provision the first coordinator

Coordinators **cannot** self-register (blocking function rejects non-student emails). An admin must create **both**:

1. A Firebase Auth user (`adminAuth.createUser()` — bypasses the blocking function).
2. Matching Firestore records: `users/{platformUserId}` with `role: "coordinator"` and `userIdentities/firebase__{firebaseUid}`.

There is no production admin UI for this in v1. Options:

- **One-off script** using `firebase-admin` + Firestore Admin SDK locally (mirror `makeCoordinator()` in `backend/tests/component/routes/users.test.ts`).
- **Manual** Firestore Console writes after creating the Auth user in Firebase Console (error-prone — prefer a script).

The coordinator signs in with Email/Password at the Hosting URL. Students self-serve with `@student.rmit.edu.au` addresses per [WORKFLOW-API-SPEC.md](./WORKFLOW-API-SPEC.md) §6.

### Seed dev demo data (optional)

After coordinator + student Auth accounts exist and the coordinator has `role: coordinator` on `GET /api/v1/users/me`:

```bash
SEED_API_BASE_URL=https://your-org-internbot-dev.web.app \
SEED_FIREBASE_API_KEY=<from firebase-web-config apiKey> \
SEED_COORD_EMAIL=coord@rmit.edu.au SEED_COORD_PASSWORD=... \
SEED_STUDENT_EMAIL=s1234567@student.rmit.edu.au SEED_STUDENT_PASSWORD=... \
  pnpm --filter backend run seed
```

Refuses URLs containing `prod` unless `SEED_FORCE=yes`. Creates semester, opportunities, sample internships, and a ticket. See `backend/scripts/seed.ts`.

### First active semester

Either run the seed script (above) or have a coordinator create a semester in the UI and transition it to an active/enrollment state via `POST /api/v1/semesters/{id}/transitions`.

---

## Troubleshooting

| Symptom                                                      | Likely cause                                                 | What to do                                                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| GitHub deploy: `permission denied` / WIF error               | Wrong `wif_provider`, SA email, or repo id in `deploy-*.yml` | Re-run `terraform output`; confirm `github_repository_id` matches fork                                |
| `terraform init` bucket not found                            | Bootstrap §2 not run for that project                        | Create `{project}-tf-state` bucket                                                                    |
| Hosting build: secret not found                              | Terraform `web-app` module not applied                       | `terraform apply`; check `firebase-web-config` in Secret Manager                                      |
| `auth/invalid-api-key` locally                               | Empty `NEXT_PUBLIC_FIREBASE_*`                               | Fill `frontend/.env.local`; restart dev server                                                        |
| Student sign-up works but API returns 403 `no_platform_user` | Email not verified                                           | Verify inbox link, or dev-only `AUTO_VERIFY_EMAIL=true`                                               |
| Coordinator cannot sign in / 403                             | Auth user exists but no `users` doc or wrong `role`          | Complete §Post-deploy coordinator provisioning                                                        |
| Advisor / FAQ **503**                                        | `RAG_SERVICE_URL` unset or RAG down                          | Check function env; deploy interbotRAG; redeploy Internbot functions                                  |
| Advisor **502**                                              | RAG returned error                                           | Check interbotRAG logs; confirm ingest + Supabase/Gemini env on RAG function                          |
| Terraform plan wants to recreate web app                     | Existing Console app not imported                            | [INFRASTRUCTURE.md § Frontend build config](./INFRASTRUCTURE.md#frontend-build-config-secret-manager) |
| `enforceStudentEmail` deploy fails wiring                    | Function not deployed before `wire_blocking_function = true` | Follow §6 two-step order                                                                              |
| Seed script: `role=student` for coordinator                  | Coordinator not promoted in Firestore                        | Fix `users/{id}.role` before re-running seed                                                          |

---

## 11. What not to migrate blindly

- **Firestore data** from the old team’s projects — contains real user data; plan a formal export/import if required.
- **Service account keys** from the outgoing team — rotate and create keys under your GCP org.
- **interbotRAG Supabase** — re-run ingest on your Supabase project; do not copy vectors across accounts unless you have a documented process.

---

## 12. Human handoff checklist

Confirm with the outgoing team (password manager or secure channel):

- [ ] GitHub org/repo admin access transferred
- [ ] GCP/Firebase/Supabase project ownership (or new projects created)
- [ ] Billing account continuity
- [ ] Gemini API key ownership
- [ ] No reliance on old `internbot-dev-ae3a3` / `internbot-prod` / `internbotrag` after cutover
- [ ] Coordinator and test student credentials documented (or reset)
- [ ] Any third-party integrations (Analytics, etc.) documented

---

## 13. Reference docs

| Topic                | Document                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Architecture         | [ARCHITECTURE.md](./ARCHITECTURE.md)                                                                  |
| CI/CD                | [CI-CD.md](./CI-CD.md)                                                                                |
| Terraform            | [INFRASTRUCTURE.md](./INFRASTRUCTURE.md)                                                              |
| Env vars             | [ENV-VARS.md](./ENV-VARS.md)                                                                          |
| API / domain         | [WORKFLOW-API-SPEC.md](./WORKFLOW-API-SPEC.md)                                                        |
| interbotRAG handover | [interbotRAG docs/HANDOVER.md](https://github.com/giatinhuynh/interbotRAG/blob/main/docs/HANDOVER.md) |

---

## 14. Handover contacts

| Item                            | Value                                            |
| ------------------------------- | ------------------------------------------------ |
| Internbot repo                  | https://github.com/giatinhuynh/Internbot         |
| interbotRAG repo                | https://github.com/giatinhuynh/interbotRAG       |
| Current dev project (outgoing)  | `internbot-dev-ae3a3`                            |
| Current prod project (outgoing) | `internbot-prod`                                 |
| Current RAG project (outgoing)  | `internbotrag` (example URL in `deploy-dev.yml`) |

Replace all outgoing project ids with your own before go-live.

---

## 15. Actual deployment run notes — RMIT-Garage (2026-06)

What the RMIT-Garage team actually deployed, and the concrete gotchas hit — so the next team doesn't rediscover them.

### Deployed environments (current)

| Env            | Project (number)                      | URL                                                                      | How it was deployed                               |
| -------------- | ------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Internbot dev  | `internbot-dev-f1abe` (#421196143498) | https://internbot-dev-f1abe.web.app                                      | Terraform + CI (push `develop`)                   |
| Internbot prod | `internbot-65e94` (#1022879312196)    | https://internbot-65e94.web.app                                          | Terraform (local apply) + local `firebase deploy` |
| interbotRAG    | `internbotrag-178b0`                  | `https://australia-southeast1-internbotrag-178b0.cloudfunctions.net/api` | CI (push `main`)                                  |

GitHub: `RMIT-Garage/Internbot`, `RMIT-Garage/interbotRAG`. Firebase/gcloud identity: `alexbonti83@gmail.com`. Prod CI auto-deploy is NOT wired yet — it needs the `terraform-ci` SA on `internbot-65e94` (see gotcha 5); prod was deployed with a local `firebase deploy`.

### Gotchas hit during deploy (and the fix)

1. **`terraform apply` token expiry.** The ~55 Firestore composite indexes take ~50 min to build; a static `gcloud auth print-access-token` (1 h TTL) expires mid-apply → `Error 401: Failed to upload state` + a stale lock, leaving partial remote state. **Fix:** run `terraform apply -parallelism=30` (builds indexes concurrently, ~15 min — fits the token); better, use real ADC (`gcloud auth application-default login`, auto-refreshes). **Recovery if it happens:** `gsutil rm gs://<project>-tf-state/terraform/state/default.tflock`; `terraform state push -lock=false -force errored.tfstate`; for any index that built on GCP but isn't in state (query `gcloud firestore indexes composite list`), add a Terraform `import {}` block; re-apply.
2. **`google_firebase_project` already exists.** An already-Firebase-enabled project must be imported before the first apply: `terraform import module.firebase_project.google_firebase_project.default <project-id>`.
3. **Missing `billingbudgets.googleapis.com`.** `main.tf` creates a `google_billing_budget` but the `firebase-project` module didn't enable that API → apply 403. **Fixed** by adding `billingbudgets.googleapis.com` to the module `required_apis`.
4. **CI Terraform version vs state.** `_terraform.yml` pinned `1.10.5` but the local apply wrote state with `1.15.6` → CI refuses "state created by a newer version." **Fixed** by bumping `_terraform.yml` to `1.15.6`.
5. **`terraform-ci` SA (CI Terraform job).** The CI `terraform` job impersonates `terraform-ci@<project>`. Create it and grant `roles/editor, iam.securityAdmin, iam.workloadIdentityPoolAdmin, iam.serviceAccountAdmin, resourcemanager.projectIamAdmin, storage.admin`, plus a WIF binding scoped to the deploy branch (`principalSet …/attribute.ref/refs/heads/{develop|main}`). A _local_ first apply uses your own creds and does NOT need this.
6. **Manual `firebase deploy --only functions` rejects `backend/.env`.** Functions rejects reserved-prefix keys (`FIREBASE_*`, `PORT`). Move `backend/.env` aside during a manual deploy and rely on `backend/.env.<projectId>` holding only safe runtime keys (`RAG_SERVICE_URL`). On the deployed function the project comes from `GCLOUD_PROJECT` and admin creds from the runtime SA, so those keys aren't needed.
7. **`api` public function transient 500.** First deploy on a fresh project can fail `api` with `HTTP 500 Could not create Cloud Run service` (no org policy involved) — just re-run the deploy; it succeeds once the serverless backend warms up.
8. **Storage `OBJECT_FINALIZE` first-event delay.** On a freshly-provisioned bucket the Eventarc trigger for `syncAttachmentMetadata` doesn't deliver its first event for a while, so offer-attachment uploads never `finalize`. The seed tolerates this (skips the offer step, leaves internships `applied`). It warms up on its own — re-run the seed later to populate the offer-stage internships.
9. **`enforceStudentEmail` auto-wires at deploy.** Deploying the `beforeUserCreated` blocking function registers it as a GCIP `beforeCreate` trigger _regardless_ of Terraform's `wire_blocking_function`, so **client sign-up requires an `s#######@student.rmit.edu.au` email**. Admin-created users (Identity Toolkit admin API / Admin SDK) bypass it — that's how coordinators are provisioned.
10. **Coordinators can't JIT.** The JIT hydrator only mints `role: student` for verified student-shaped emails. A coordinator needs a Firebase Auth user **plus** a `users/{id}` doc (`role: coordinator`, `onboardingStage: profile_complete`, `version: 1`, `_schemaVersion: 1`) and a `userIdentities/firebase__{uid}` sentinel, created out-of-band.
11. **Firestore/Storage rules in CLI deploys.** Rules are Terraform-managed; `firebase.json` now also references `docker/firebase-emulator/firebase/*.rules` so a plain `firebase deploy` can push them.
12. **Seed vs semester lifecycle.** The seed used the removed `active` status; semesters are now created `draft` and transitioned to `enrollment_open`. **Fixed** in `backend/scripts/seed.ts`.
13. **interbotRAG AI = Gemini billing.** RAG advisor/FAQ returns **502** when the Gemini API key's prepaid credits are depleted (`429 "prepayment credits are depleted"` on the query-embedding call, seen in the RAG `api` logs). Top up billing in Google AI Studio — no redeploy needed.

### Seeded demo credentials

Demo/test accounts created by `backend/scripts/seed.ts`. **These are throwaway demo credentials — rotate (or delete) before any real production use.**

| Env  | Role        | Email                          | Password           |
| ---- | ----------- | ------------------------------ | ------------------ |
| dev  | coordinator | `coordinator@rmit.edu.au`      | `Aa1!1r1FCg256VPP` |
| dev  | student     | `s3999999@student.rmit.edu.au` | `Aa1!XGkiyL0dLg76` |
| prod | coordinator | `coordinator@rmit.edu.au`      | `Aa1!jhZt5EJovmX9` |
| prod | student     | `s3999999@student.rmit.edu.au` | `Aa1!zrivv3FUY1nu` |

Re-seed a fresh env: create the coordinator (admin API + `users/{id}` doc + identity sentinel, per gotcha 10) and student (admin-create with `emailVerified: true`), then:

```bash
SEED_API_BASE_URL=<hosting-url> SEED_FIREBASE_API_KEY=<web-api-key> \
SEED_COORD_EMAIL=… SEED_COORD_PASSWORD=… SEED_STUDENT_EMAIL=… SEED_STUDENT_PASSWORD=… \
[SEED_FORCE=yes  # only if the URL doesn't contain "dev"] \
  pnpm --filter backend run seed
```

### Known application bugs

See [KNOWN-ISSUES.md](./KNOWN-ISSUES.md).
