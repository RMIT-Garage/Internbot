resource "google_firestore_database" "default" {
  provider                    = google-beta
  project                     = var.project_id
  name                        = "(default)"
  location_id                 = var.firestore_location
  type                        = "FIRESTORE_NATIVE"
  concurrency_mode            = "OPTIMISTIC"
  app_engine_integration_mode = "DISABLED"
}

# Firestore security rules — managed via Terraform so they're drift-detected
# and deployed atomically with the rest of the infra.
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../../../docker/firebase-emulator/firebase/firestore.rules")
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = "projects/${var.project_id}/rulesets/${google_firebaserules_ruleset.firestore.name}"

  lifecycle {
    replace_triggered_by = [google_firebaserules_ruleset.firestore]
  }
}

# Firestore composite indexes — read from the same JSON file the emulator
# uses, so dev + prod stay in lockstep. Adding an index in the JSON
# automatically provisions it on the next `terraform apply`.
locals {
  firestore_indexes_file = "${path.module}/../../../docker/firebase-emulator/firebase/firestore.indexes.json"
  firestore_indexes      = jsondecode(file(local.firestore_indexes_file)).indexes
  firestore_indexes_keyed = {
    for idx, def in local.firestore_indexes :
    "${def.collectionGroup}_${join("_", [for f in def.fields : "${f.fieldPath}_${f.order}"])}" => def
  }
}

resource "google_firestore_index" "composite" {
  for_each = local.firestore_indexes_keyed

  provider    = google-beta
  project     = var.project_id
  database    = google_firestore_database.default.name
  collection  = each.value.collectionGroup
  query_scope = each.value.queryScope

  dynamic "fields" {
    for_each = each.value.fields
    content {
      field_path = fields.value.fieldPath
      order      = fields.value.order
    }
  }
}
