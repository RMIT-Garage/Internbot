---
description: Add an environment variable consistently — classify correctly (non-secret config vs NEXT_PUBLIC vs runtime secret vs build-time secret), then update the right files. Use when a new configuration value is needed.
argument-hint: "[VAR_NAME] [frontend|backend|both]"
---

# Skill: /add-env-var

Add a new environment variable consistently. **Step 1 is classification — get this wrong and everything else breaks.**

## Step 1 — Classify the value (mandatory)

Ask the user, or infer from context. Every value is exactly one of:

| #   | Category                                                          | Where it lives                                                                                                                                            | Injected into CI how                                                                     |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1   | **Non-secret config** (project ID, region, app name, URL)         | Committed: `tfvars`, workflow `env:`, code default                                                                                                        | Hardcoded in workflow `with:` or `env:` — repo is source of truth                        |
| 2   | **`NEXT_PUBLIC_*` build values** (visible in browser anyway)      | Firebase web SDK values: Secret Manager `firebase-web-config` (Terraform-owned). Constants (e.g. `NEXT_PUBLIC_APP_NAME`): code default or workflow `env:` | Hosting workflow fetches the secret with `gcloud` and writes each field to `$GITHUB_ENV` |
| 3   | **Build-time secret** (API key used during build, NOT in browser) | GCP Secret Manager                                                                                                                                        | `google-github-actions/get-secretmanager-secrets@v2`                                     |
| 4   | **Runtime backend secret** (Stripe, OpenAI, SendGrid)             | GCP Secret Manager via `defineSecret()`                                                                                                                   | **Never — GitHub Actions does NOT touch these**                                          |
| 5   | **Deploy credential**                                             | Nothing — OIDC/WIF replaces them                                                                                                                          | `google-github-actions/auth@v2` mints short-lived token                                  |
| 6   | **Local dev only**                                                | `backend/.env` (non-secret) or `backend/.secret.local` (secret, gitignored)                                                                               | N/A — local only                                                                         |

**Litmus test:** "If an attacker knows this value, do they gain any power?" No → config. Yes → secret.

### Red flags — reject these before starting

- ❌ Putting a non-secret (`FIREBASE_PROJECT_ID`, region) into GitHub Secrets, Secret Manager, or even GitHub Variables → pretending config is secret; commit it instead
- ❌ Putting a runtime backend secret into GitHub Actions `env:` at deploy → bypasses Secret Manager IAM, visible in Cloud Function env to viewers
- ❌ Prefixing a server-side secret with `NEXT_PUBLIC_` → it will ship in the browser bundle
- ❌ Committing `.env` files with real values → only `.env.example` is committed
- ❌ Committing `terraform.tfvars` with env-specific values → CI/CD injects via `TF_VAR_*`

## Step 2 — Route based on classification

### Category 1 — Non-secret config (most common)

**Non-secret config lives in the repo.** No GitHub variables, no Secret Manager. PR review is the change control.

**If backend runtime:**

- Add to `backend/.env.example` with placeholder and comment
- Add to `backend/.env` locally (gitignored)
- Access via `process.env.NAME` in code
- If CI/CD needs it: hardcode in the workflow `env:` block or `with:` input. Don't use `gh variable set` — the repo is the source of truth.

**If Terraform needs it:**

- Shared across envs → `variables.tf` with a default
- Env-specific → add to `infrastructure/envs/{dev,prod}.tfvars` (committed, non-secret)
- Derivable from GitHub Actions context → inject via `TF_VAR_*` env var in `_terraform.yml` (e.g. `github_repository`)

### Category 2 — `NEXT_PUBLIC_*` build values

- Add to `frontend/.env.example` with a comment
- Add to `frontend/.env.local` locally (gitignored)
- Access via `process.env.NEXT_PUBLIC_NAME`

**For CI builds, route based on what the value is:**

**2a. Firebase web SDK / app URL values** (e.g. `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`) — owned by Terraform, packed into the `firebase-web-config` Secret Manager secret. Add a key to `local.web_config_json` in `infrastructure/modules/web-app/main.tf`:

```hcl
locals {
  web_config_json = jsonencode({
    apiKey = data.google_firebase_web_app_config.default.api_key
    # ... existing keys
    newField = "computed-or-derived-value"
  })
}
```

Then add a matching export in `.github/workflows/_deploy-hosting.yml` so the build step sees it:

```bash
echo "NEXT_PUBLIC_NEW_FIELD=$(echo "$config_json" | jq -r '.newField')" >> "$GITHUB_ENV"
```

Add the field to the `jq -e` validation list at the top of the same step.

**2b. Constants that aren't env-specific** (e.g. `NEXT_PUBLIC_APP_NAME = "Internbot"`) — keep them as workflow inputs in `_deploy-hosting.yml` with a default:

```yaml
inputs:
  public_new_constant:
    type: string
    default: "value"
```

### Category 3 — Build-time secret (rare, distinct from Category 2a)

For non-Firebase-SDK build-time secrets that don't fit the `firebase-web-config` shape (e.g. a third-party API key needed during the bundle build).

- Create in Secret Manager: `echo -n 'value' | gcloud secrets create NAME --data-file=- --project=internbot-dev-ae3a3`
- Grant deploy SA access: `gcloud secrets add-iam-policy-binding NAME --member=serviceAccount:github-deploy@... --role=roles/secretmanager.secretAccessor` (or, preferred, manage the binding in Terraform)
- In the workflow, fetch with `gcloud` after the OIDC auth step:
  ```yaml
  - run: |
      echo "NAME=$(gcloud secrets versions access latest --secret=NAME --project=${{ inputs.firebase_project_id }})" >> "$GITHUB_ENV"
  - run: pnpm --filter frontend build
  ```
  Don't reach for `google-github-actions/get-secretmanager-secrets@v2` — the rest of the repo uses plain `gcloud` to keep one auth surface.

### Category 4 — Runtime backend secret

**Code change:**

```typescript
// backend/src/index.ts
import { defineSecret } from "firebase-functions/params";

const NAME = defineSecret("NAME");

export const api = onRequest({ secrets: [NAME] }, (req, res) => {
  process.env.NAME = NAME.value();
  // ... handler reads process.env.NAME
});
```

**Set the value once per environment:**

```bash
echo -n "dev-value" | firebase functions:secrets:set NAME \
  --project internbot-dev-ae3a3 --data-file=-
echo -n "prod-value" | firebase functions:secrets:set NAME \
  --project internbot-prod --data-file=-
```

**Local dev:** add to `backend/.secret.local` (gitignored):

```
NAME=local-test-value
```

Firebase emulator auto-loads this file.

**GitHub Actions does NOT touch this variable.** Do not add it to workflow `env:`.

### Category 5 — Deploy credential

Already handled via OIDC/WIF. Never add new deploy credentials as secrets.

### Category 6 — Local dev only

- Add to `backend/.env` (non-secret) or `backend/.secret.local` (secret)
- Do NOT commit
- Do NOT add to CI workflows
- Do NOT add to `.env.example` unless it's documented as "local-only" with comment

## Step 3 — Documentation

**Always update `docs/ENV-VARS.md`** — add a row to the table, classify correctly, note where it's set.

**Update `docs/SECURITY.md`** if:

- It's a rotatable secret → document the rotation procedure
- It's a runtime secret → note `defineSecret()` pattern

## Step 4 — Verify before done

- [ ] Correct category chosen, not pretending config is secret (or vice versa)
- [ ] `NEXT_PUBLIC_` prefix ONLY on values safe to ship in browser
- [ ] `.env.example` updated with placeholder + descriptive comment
- [ ] Code has clear error or fallback if missing (at startup, not deep in a handler)
- [ ] Committed to repo (tfvars / workflow `env:` / workflow `with:`) if CI needs the value — NOT in GitHub variables unless you have a specific reason
- [ ] Secret Manager populated if it's a Category 3 or 4 value
- [ ] `defineSecret()` wired in backend code for Category 4
- [ ] `backend/.secret.local` added locally (NOT committed) for Category 4 local dev
- [ ] `docs/ENV-VARS.md` updated
- [ ] `docs/SECURITY.md` updated if secret
