# Environment Variables

## The rule: classify before touching

Every value belongs to exactly one of these categories. Pick the right one before adding it anywhere.

| Category                    | What it is                                                             | Where it lives                                                         | Who reads it                                                                   |
| --------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Non-secret config**       | Project IDs, regions, app names, public URLs                           | Code default, GitHub **repo variables** (`vars.*`), or workflow `env:` | Anywhere — committed, logged, visible to contributors                          |
| **Public-bundle values**    | `NEXT_PUBLIC_*` — ship in the browser bundle                           | Secret Manager (`firebase-web-config`, written by Terraform)           | Frontend build step in CI fetches via `gcloud secrets versions access`         |
| **Build-time secrets**      | API keys needed to build the frontend bundle but NOT meant for browser | Secret Manager                                                         | GitHub Actions fetches during build, never committed                           |
| **Runtime backend secrets** | Stripe, OpenAI, SendGrid keys used by Cloud Functions                  | `defineSecret()` → Secret Manager                                      | Function reads directly at cold start — **GitHub Actions never touches these** |
| **Deploy credentials**      | Service account to run `firebase deploy`                               | None — OIDC/WIF replaces them                                          | GitHub Actions mints short-lived tokens per job                                |
| **Local dev values**        | Same variables for emulator-based dev                                  | `backend/.env` and `backend/.secret.local` (gitignored)                | Firebase emulator auto-loads                                                   |

**The litmus test for "is this a secret?"**

> If an attacker knowing the value gives them zero additional power, it's not a secret. Treat it as config.

Project IDs, region names, and `NEXT_PUBLIC_*` values are **not secrets** — they ship in URLs and browser bundles.

## How values get into CI/CD

**Non-secret values live in the repo, not GitHub variables.** The repo is self-documenting: cloning it tells you exactly what deploys where.

### Terraform values

`infrastructure/envs/dev.tfvars` and `infrastructure/envs/prod.tfvars` hold env-specific non-secret config (committed). The workflow runs:

```yaml
- run: terraform plan -var-file=envs/dev.tfvars
```

Values that come from GitHub Actions context (no storage needed):

- `github_repository` → `${{ github.repository }}`
- `github_repository_id` → `${{ github.repository_id }}`

These flow as `TF_VAR_*` env vars in `_terraform.yml`.

### Firebase deploy values

Stable identity values — project IDs, WIF provider ARNs, deploy SA emails — are **hardcoded in the trigger workflow files** (`deploy-dev.yml`, `deploy-prod.yml`). They're not secret, rarely change, and reading the workflow tells you what it deploys.

Firebase web-config values (`NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`) are **owned by Terraform** (`infrastructure/modules/web-app/`) and exported to a single Secret Manager secret named `firebase-web-config` — same name in every project, only the project ID varies. The hosting deploy workflow runs `gcloud secrets versions access latest --secret=firebase-web-config --project=<env>`, unpacks the JSON with `jq`, and uses the values to build the static bundle. Adding or rotating an env requires zero workflow changes.

Backend Storage access defaults to `${FIREBASE_PROJECT_ID}-storage`, matching the Terraform bucket convention. Set `FIREBASE_STORAGE_BUCKET` only when running the backend against a nonstandard bucket.

### GitHub Secrets/Variables

**None used.** OIDC + Secret Manager + committed tfvars + hardcoded workflow values cover all needs.

GitHub Secrets would only be for:

- Values that genuinely can't live in Secret Manager (third-party webhook URLs, etc.)
- Values that must rotate frequently without PR review

GitHub Variables would only be for:

- Values that differ per-repo-fork
- Values you want to change without a PR

## Runtime backend secrets — `defineSecret()`

When you add a runtime secret (e.g. Stripe API key):

```typescript
// backend/src/index.ts
import { defineSecret } from "firebase-functions/params";
import { onRequest } from "firebase-functions/v2/https";

const stripeKey = defineSecret("STRIPE_API_KEY");

export const api = onRequest(
  { region: "australia-southeast1", secrets: [stripeKey] },
  (req, res) => {
    process.env.STRIPE_API_KEY = stripeKey.value();
    // ... handler uses process.env.STRIPE_API_KEY
  },
);
```

Set the value **once, out-of-band** (never via GitHub Actions):

```bash
echo -n "sk_live_xxx" | firebase functions:secrets:set STRIPE_API_KEY \
  --project internbot-prod --data-file=-
```

Local dev: put `STRIPE_API_KEY=sk_test_xxx` in `backend/.secret.local` (gitignored) — the Functions emulator auto-loads it.

## Local development files

```
backend/
├── .env                        # non-secret params, shared via .env.example
├── .env.example                # committed template
├── .env.local                  # non-secret per-dev overrides (gitignored)
├── .env.internbot-dev-ae3a3    # optional per-project overrides (gitignored)
└── .secret.local               # SECRETS for emulator (gitignored)
```

Canonical dev onboarding:

1. Copy `backend/.env.example` → `backend/.env` and fill in non-secret defaults
2. Create `backend/.secret.local` with any secrets needed for emulator testing (from a shared password manager if secrets exist)
3. Run `pnpm run dev` — emulators + frontend start together

## Adding a new variable

Use the `/add-env-var` Claude Code skill for consistency.

**Decision tree:**

```
Is it used by Cloud Functions at runtime?
├── YES, and it's sensitive → defineSecret() in backend code + functions:secrets:set + .secret.local locally
├── YES, non-sensitive → plain process.env via backend/.env
│
Is it used by the frontend?
├── YES, public (NEXT_PUBLIC_*) → add to firebase-web-config secret JSON in infrastructure/modules/web-app, fetched by hosting deploy workflow
├── YES, private build-time secret → Secret Manager, fetched in GH Actions during build
│
Is it only used by Terraform/CI?
├── env-specific → GitHub repo variable, injected as TF_VAR_* in workflow
└── shared default → terraform variable default in variables.tf
```
