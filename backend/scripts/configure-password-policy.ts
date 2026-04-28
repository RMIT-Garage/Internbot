#!/usr/bin/env tsx
/**
 * Applies the project-level Identity Platform password policy.
 *
 * Why a one-shot script: the Terraform `google_identity_platform_config`
 * resource does not expose `password_policy_config`, so we configure it via
 * the Firebase Admin SDK (`projectConfigManager().updateProjectConfig`).
 * Run once per environment after Terraform creates the project; idempotent.
 *
 * Usage:
 *   FIREBASE_PROJECT_ID=internbot-dev \
 *     pnpm --filter backend run auth:configure-password-policy
 *
 * Auth: same conventions as the runtime — ADC (`gcloud auth
 * application-default login`) or `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`.
 * Refuses to run against the emulator (the admin endpoint is real-project-only).
 */

import { adminAuth } from '../src/infrastructure/config/firebase-admin'

const POLICY = {
  enforcementState: 'ENFORCE' as const,
  // Don't invalidate already-issued sessions for accounts whose password
  // pre-dates this policy — they re-authenticate at next sign-in anyway.
  forceUpgradeOnSignin: false,
  constraints: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumeric: true,
    requireNonAlphanumeric: true,
  },
}

async function main(): Promise<void> {
  if (process.env.USE_EMULATOR === 'true') {
    throw new Error(
      'Refusing to run against the Firebase emulator — password policy is a real-project setting.'
    )
  }

  const updated = await adminAuth.projectConfigManager().updateProjectConfig({
    passwordPolicyConfig: POLICY,
  })

  process.stdout.write(
    `Password policy applied: ${JSON.stringify(updated.passwordPolicyConfig, null, 2)}\n`
  )
}

void main().catch((error: unknown) => {
  process.stderr.write(`Failed to apply password policy: ${String(error)}\n`)
  process.exitCode = 1
})
