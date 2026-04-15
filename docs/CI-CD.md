# CI/CD

## Pipeline overview

```
PR opened/updated (targets main or develop)
    │
    ├── ci.yml                              → Lint + typecheck, FE tests, BE tests, security scan
    └── terraform-plan.yml (if infra/**)    → plan against dev; also prod if PR targets main
                                              Posts plan diff as PR comment
    │
    ▼ (PR merged)
Push to develop                                Push to main
    │                                          │
    ├── ci.yml                                 ├── ci.yml
    ├── deploy-dev.yml (always)                ├── deploy-prod.yml (always)
    └── terraform-apply-dev.yml (if infra/**)  └── terraform-apply-prod.yml (if infra/**)
```

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

| File                       | Triggers                                     | Purpose                                      |
| -------------------------- | -------------------------------------------- | -------------------------------------------- |
| `ci.yml`                   | PR to main/develop, push to main/develop     | Lint, typecheck, tests, security             |
| `deploy-dev.yml`           | push to develop                              | Deploy backend to dev                        |
| `deploy-prod.yml`          | push to main                                 | Deploy backend to prod                       |
| `_deploy.yml`              | workflow_call                                | Reusable deploy engine                       |
| `terraform-plan.yml`       | PR touching `infrastructure/**`              | Plan against dev (+ prod if PR targets main) |
| `terraform-apply-dev.yml`  | push to develop touching `infrastructure/**` | Apply to dev                                 |
| `terraform-apply-prod.yml` | push to main touching `infrastructure/**`    | Apply to prod                                |
| `_terraform.yml`           | workflow_call                                | Reusable Terraform engine                    |

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
