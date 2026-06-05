# Infrastructure

GCP + Firebase resources are managed with **Terraform** in `infrastructure/`. Deploys run through GitHub Actions via OIDC/WIF.

## Modules

| Module             | Responsibility                                                         |
| ------------------ | ---------------------------------------------------------------------- |
| `firebase-project` | Firebase project enablement                                            |
| `auth`             | Firebase Authentication / Identity Platform config                     |
| `firestore`        | Firestore database                                                     |
| `storage`          | Firebase Storage bucket                                                |
| `hosting`          | Firebase Hosting default site (tracks auto-created site in state)      |
| `github-oidc`      | Workload Identity pool, OIDC provider, github-deploy SA, role bindings |
| `web-app`          | Firebase Web App + `firebase-web-config` Secret Manager export         |

## Environments

| Env  | GCP project           | State bucket                   | Terraform SA                       | WIF ref restriction    |
| ---- | --------------------- | ------------------------------ | ---------------------------------- | ---------------------- |
| Dev  | `internbot-dev-ae3a3` | `internbot-dev-ae3a3-tf-state` | `terraform-ci@internbot-dev-ae3a3` | any ref                |
| Prod | `internbot-prod`      | `internbot-prod-tf-state`      | `terraform-ci@internbot-prod`      | `refs/heads/main` only |

## How values get into Terraform

**Env-specific non-secret config is committed to the repo** in `infrastructure/envs/{env}.tfvars`. This is standard Terraform practice and keeps the repo self-documenting.

Committed tfvars (`infrastructure/envs/dev.tfvars`, `prod.tfvars`):

- `project_id` — which GCP project this env maps to
- `github_allowed_refs` — which git refs can impersonate the deploy SA

Variables that come from GitHub Actions context (not stored anywhere):

- `github_repository` — injected via `TF_VAR_github_repository: ${{ github.repository }}`
- `github_repository_id` — injected via `TF_VAR_github_repository_id: ${{ github.repository_id }}`

Shared defaults in `variables.tf`:

- `region`, `firestore_location`, `deploy_sa_roles`

CI runs `terraform plan -var-file=envs/dev.tfvars` (or `prod.tfvars`). For local dev, copy `terraform.tfvars.example` to `terraform.tfvars` and run `terraform plan` directly.

See [ENV-VARS.md](./ENV-VARS.md) and [CI-CD.md](./CI-CD.md).

## Known limitation — PR plans with tight WIF refs

Dev is locked to `refs/heads/develop` only. Prod is locked to `refs/heads/main`. This means PR plans from feature branches (ref = `refs/pull/N/merge`) currently fail because they can't impersonate the env's `terraform-ci` SA.

**Workaround today:** run `terraform plan` locally against the target env before opening the PR.

**Future fix (if needed):** add a separate `terraform-plan-reader` SA per env with read-only roles + loose WIF binding (any ref from the repo), used only for PR plans. Apply still uses the strict SA.

## CI/CD workflows

| Workflow              | Trigger                        | Purpose                                                                |
| --------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `terraform-plan.yml`  | PR touches `infrastructure/**` | Plan against dev (+ prod if PR targets main); posts diff as PR comment |
| `_terraform.yml`      | `workflow_call`                | Reusable engine — init, fmt, validate, plan/apply                      |
| `deploy-dev.yml`      | Push to develop                | `ci` → `terraform apply dev` → functions + hosting deploy              |
| `deploy-prod.yml`     | Push to main                   | `ci` → `terraform apply prod` → functions + hosting deploy             |
| `_deploy.yml`         | `workflow_call`                | Reusable: `firebase deploy --only functions`                           |
| `_deploy-hosting.yml` | `workflow_call`                | Reusable: static frontend build + `firebase deploy --only hosting`     |

`terraform apply` is a job inside the env deploy pipeline — not a separate workflow. It uses OIDC auth via the env's `terraform-ci` SA. The SA has enough IAM scope to manage project resources but no app-deploy permissions.

## Local development

### Prerequisites

```bash
brew install terraform tflint
gcloud auth login
gcloud auth application-default login
gcloud config set project internbot-dev-ae3a3
```

### First-time plan from laptop

```bash
cd infrastructure

# Copy the example, fill in non-secret values (gitignored)
cp terraform.tfvars.example terraform.tfvars

# Initialise with the correct state backend (per env)
terraform init -backend-config="bucket=internbot-dev-ae3a3-tf-state"

# If this is a brand-new env with resources created manually, import first:
./scripts/import-existing.sh dev

# Preview + apply
terraform plan
terraform apply
```

To switch envs locally, re-init with the other state bucket:

```bash
rm -rf .terraform
terraform init -backend-config="bucket=internbot-prod-tf-state"
```

## Frontend build config (Secret Manager)

The hosting deploy workflow does not take Firebase web SDK values as inputs — they live in a single Secret Manager secret per project, named `firebase-web-config` everywhere. The `web-app` module:

- Provisions a `google_firebase_web_app` resource
- Reads its SDK config via the `google_firebase_web_app_config` data source
- Packs `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`, `measurementId`, `apiUrl`, `appUrl` into one JSON value
- Writes that JSON to `firebase-web-config`
- Grants `roles/secretmanager.secretAccessor` on just that secret to the deploy SA

`_deploy-hosting.yml` fetches the secret with `gcloud secrets versions access` after OIDC auth, unpacks it with `jq`, and exports each field as a `NEXT_PUBLIC_*` env var for the Next.js build.

**Bootstrapping a project that already has a Web App** (the dev project was created via the Firebase Console, so its app pre-dates Terraform):

```bash
cd infrastructure

# `firebase apps:list` is a Firebase CLI command (not gcloud) and the
# --json output is wrapped as { status, result: [...] }
APP_ID=$(firebase --project=internbot-dev-ae3a3 apps:list WEB --json \
  | jq -r '.result[0].appId')

terraform import -var-file=envs/dev.tfvars \
  'module.web_app.google_firebase_web_app.default' \
  "projects/internbot-dev-ae3a3/webApps/${APP_ID}"
```

Fresh projects (e.g. prod, which has no web app yet) skip the import — the next `terraform apply` creates it cleanly.

## Importing pre-existing resources

Some resources were created manually via `gcloud` before Terraform adoption (WIF pool, deploy SA, bindings). To bring them under Terraform management without recreation:

```bash
cd infrastructure
terraform init -backend-config="bucket=internbot-dev-ae3a3-tf-state"
./scripts/import-existing.sh dev
terraform plan   # should show 0 changes if import matched
```

Repeat for prod with `./scripts/import-existing.sh prod` and the prod state bucket.

## Drift detection

Every `terraform plan` calls the GCP API and compares live state against code. If someone changes a resource via the GCP Console, the next plan surfaces the diff and the next apply reverts it.

Enforced on every PR touching `infrastructure/**` via `terraform-plan.yml`.

## Linting

```bash
cd infrastructure
tflint --init
tflint
```

Also enforced in `_terraform.yml` via `terraform fmt -check` and `terraform validate`.

## State management

- Backend is **GCS**, one bucket per project, versioning enabled
- State locking uses GCS object generation conditions — Terraform handles this automatically
- Never edit `terraform.tfstate` by hand — use `terraform state` subcommands
- Never commit `.terraform/` or `terraform.tfstate*` (gitignored)

## Bootstrap — how state buckets and Terraform SAs were created

These were created once via `gcloud` before Terraform could manage them. Commands for reference (already run; documented for recreation if needed):

```bash
# Per project: internbot-dev-ae3a3 and internbot-prod

# State bucket
gcloud storage buckets create gs://${PROJECT_ID}-tf-state \
  --project=$PROJECT_ID --location=australia-southeast1 \
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

# Bind WIF pool to terraform-ci SA (after the WIF pool exists)
gcloud iam service-accounts add-iam-policy-binding \
  terraform-ci@${PROJECT_ID}.iam.gserviceaccount.com \
  --project=$PROJECT_ID --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github/attribute.repository/giatinhuynh/Internbot"
```

These bootstrap resources are intentionally NOT in Terraform — they're the chicken-and-egg foundation Terraform needs to run.
