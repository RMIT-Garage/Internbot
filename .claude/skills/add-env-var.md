---
description: Add an environment variable consistently — classify correctly (non-secret config vs NEXT_PUBLIC vs runtime secret vs build-time secret), then update the right files. Use when a new configuration value is needed.
argument-hint: "[VAR_NAME] [frontend|backend|both]"
---

# Skill: /add-env-var

Add a new environment variable consistently. **Step 1 is classification — get this wrong and everything else breaks.**

## Step 1 — Classify the value (mandatory)

Ask the user, or infer from context. Every value is exactly one of:

| #   | Category                                                          | Where it lives                                                              | Injected into CI how                                              |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | **Non-secret config** (project ID, region, app name, URL)         | Committed: `tfvars`, workflow `env:`, code default                          | Hardcoded in workflow `with:` or `env:` — repo is source of truth |
| 2   | **`NEXT_PUBLIC_*` build values** (visible in browser anyway)      | Committed: workflow `env:` OR code default                                  | Hardcoded in workflow `env:` for build step                       |
| 3   | **Build-time secret** (API key used during build, NOT in browser) | GCP Secret Manager                                                          | `google-github-actions/get-secretmanager-secrets@v2`              |
| 4   | **Runtime backend secret** (Stripe, OpenAI, SendGrid)             | GCP Secret Manager via `defineSecret()`                                     | **Never — GitHub Actions does NOT touch these**                   |
| 5   | **Deploy credential**                                             | Nothing — OIDC/WIF replaces them                                            | `google-github-actions/auth@v2` mints short-lived token           |
| 6   | **Local dev only**                                                | `backend/.env` (non-secret) or `backend/.secret.local` (secret, gitignored) | N/A — local only                                                  |

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
- For CI builds: hardcode in the workflow `env:` block (these are public — they ship in the browser bundle, no reason to treat as secret):
  ```yaml
  - run: pnpm --filter frontend build
    env:
      NEXT_PUBLIC_NAME: "the-actual-value"
  ```

### Category 3 — Build-time secret (rare)

- Create in Secret Manager: `echo -n 'value' | gcloud secrets create NAME --data-file=- --project=internbot-dev-ae3a3`
- Grant deploy SA access: `gcloud secrets add-iam-policy-binding NAME --member=serviceAccount:github-deploy@... --role=roles/secretmanager.secretAccessor`
- In workflow:
  ```yaml
  - uses: google-github-actions/get-secretmanager-secrets@v2
    id: secrets
    with:
      secrets: |-
        NAME:internbot-dev-ae3a3/name-of-secret
  - run: pnpm --filter frontend build
    env:
      NAME: ${{ steps.secrets.outputs.NAME }}
  ```

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
