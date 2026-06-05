# Infrastructure

## Overview

Firebase and GCP resources are managed with **Terraform** in the `infrastructure/` directory.

## Resources Managed

| Resource                        | Terraform Resource                    |
| ------------------------------- | ------------------------------------- |
| Firebase Project                | `google_firebase_project`             |
| Firestore Database              | `google_firestore_database`           |
| Firebase Auth                   | `google_identity_platform_config`     |
| Cloud Storage                   | `google_firebase_storage_bucket`      |
| Firebase App Hosting (frontend) | `google_firebase_app_hosting_backend` |

## Setup

### Prerequisites

```bash
brew install terraform tflint
gcloud auth application-default login
```

### First-time setup

```bash
cd infrastructure

# Copy and fill in the variables
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project ID

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Apply
terraform apply
```

## Linting

```bash
tflint --init
tflint
```

## State Management

By default, Terraform state is stored locally. For team projects, configure remote state in `main.tf`:

```hcl
backend "gcs" {
  bucket = "{project-id}-terraform-state"
  prefix = "terraform/state"
}
```

Create the GCS bucket first:

```bash
gsutil mb gs://{project-id}-terraform-state
gsutil versioning set on gs://{project-id}-terraform-state
```

## Importing Existing Resources

If the Firebase project already exists:

```bash
terraform import google_firebase_project.default projects/{project-id}
terraform import google_firestore_database.default projects/{project-id}/databases/(default)
```
