# CI/CD

## Pipeline overview

```
PR opened/updated (targets main or develop)
    │
    ├── ci.yml             → Lint + typecheck, FE/BE tests, security (calls _ci.yml)
    └── terraform-plan.yml → plan against dev (+ prod if PR targets main). Posts diff as PR comment.
    │
    ▼ (PR merged)
Push to develop                                 Push to main
    │                                           │
    └── deploy-dev.yml (one pipeline)           └── deploy-prod.yml (one pipeline)
            │                                           │
            ├── ci       (calls _ci.yml)                ├── ci
            ├── terraform (needs: ci, _terraform.yml)   ├── terraform (needs: ci)
            └── deploy   (needs: [ci, terraform])       └── deploy   (needs: [ci, terraform])
```

Each env has **one workflow file** orchestrating the full pipeline: CI gates both
Terraform and Firebase deploy; Firebase deploy waits for Terraform so infra is
ready before the app tries to use it.

## Branch → environment mapping

| Branch    | Firebase project      | GCP project           |
| --------- | --------------------- | --------------------- |
| `develop` | `internbot-dev-ae3a3` | `internbot-dev-ae3a3` |
| `main`    | `internbot-prod`      | `internbot-prod`      |

## Authentication — zero long-lived credentials

All cloud auth uses **OIDC + Workload Identity Federation**. No service account JSON keys in GitHub Secrets.

| Purpose              | Identity                            | WIF restriction                           |
| -------------------- | ----------------------------------- | ----------------------------------------- |
| Dev Firebase deploy  | `github-deploy@internbot-dev-ae3a3` | repo ID pinned                            |
| Prod Firebase deploy | `github-deploy@internbot-prod`      | repo ID pinned + `ref == refs/heads/main` |
| Dev Terraform        | `terraform-ci@internbot-dev-ae3a3`  | repo ID pinned                            |
| Prod Terraform       | `terraform-ci@internbot-prod`       | repo ID pinned + `ref == refs/heads/main` |

## Value injection — everything is in the repo

**Non-secret config lives in the repo**, not GitHub variables. This keeps the repo self-documenting: cloning it tells you exactly what deploys where.

| Value                                                        | Where                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Env-specific Terraform values (project_id, allowed_refs)     | `infrastructure/envs/{dev,prod}.tfvars` (committed)                                    |
| Firebase deploy targets (project_id, WIF provider, SA email) | Hardcoded in `deploy-dev.yml` / `deploy-prod.yml` trigger files                        |
| Repo identity (repository, repository_id)                    | `${{ github.repository }}` / `${{ github.repository_id }}` context — no storage needed |
| Runtime backend secrets                                      | GCP Secret Manager via `defineSecret()` (never GitHub, never tfvars)                   |

**What's NOT committed:**

- `backend/.env`, `frontend/.env.local`, `infrastructure/terraform.tfvars` — all gitignored, only `.example` placeholders committed
- `backend/.secret.local` — local-only secrets for emulator
- Any real secret value — use GCP Secret Manager

**What IS committed:**

- `.env.example`, `.env.local.example`, `terraform.tfvars.example` — placeholders
- `infrastructure/envs/dev.tfvars`, `infrastructure/envs/prod.tfvars` — non-secret env config
- Workflow files with hardcoded deploy targets — stable, non-secret, self-documenting

See [ENV-VARS.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/ENV-VARS.md) for the full classification matrix.

## GitHub repo variables and secrets

**Currently empty.** OIDC + Secret Manager + committed tfvars cover all needs.

GitHub variables would only make sense for:

- Values that change per-repo-fork (none here)
- Values you want to rotate without a PR (none here)

GitHub Secrets would only be for:

- Values that can't live in Secret Manager (rare — third-party webhooks maybe)

## Workflow reference

| File                 | Triggers                        | Purpose                                                      |
| -------------------- | ------------------------------- | ------------------------------------------------------------ |
| `ci.yml`             | PR to main/develop              | Thin wrapper, calls `_ci.yml`                                |
| `_ci.yml`            | workflow_call                   | Reusable: lint, typecheck, tests, gitleaks                   |
| `deploy-dev.yml`     | push to develop                 | Pipeline: CI → terraform apply dev → firebase deploy dev     |
| `deploy-prod.yml`    | push to main                    | Pipeline: CI → terraform apply prod → firebase deploy prod   |
| `_deploy.yml`        | workflow_call                   | Reusable: build backend + `firebase deploy`                  |
| `terraform-plan.yml` | PR touching `infrastructure/**` | Plan against dev (+ prod if PR targets main). PR comment.    |
| `_terraform.yml`     | workflow_call                   | Reusable: init + fmt + validate + plan/apply                 |

## Manual deployment

**Firebase application (local):**

```bash
firebase login
pnpm --filter backend build
firebase deploy \
  --config docker/firebase-emulator/firebase.json \
  --only functions,firestore,storage \
  --project internbot-dev-ae3a3
```

**Terraform (local):**

```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars   # fill in your values (gitignored)
terraform init -backend-config="bucket=internbot-dev-ae3a3-tf-state"
terraform plan
terraform apply
```
