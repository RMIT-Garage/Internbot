# Environment Variables

## Overview

| Variable                                   | Package            | Secret  | Required | Description                                                                                  |
| ------------------------------------------ | ------------------ | ------- | -------- | -------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | frontend           | No      | Yes      | Firebase web API key                                                                         |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | frontend           | No      | Yes      | Firebase auth domain                                                                         |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | frontend           | No      | Yes      | Firebase project ID                                                                          |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | frontend           | No      | Yes      | Firebase storage bucket                                                                      |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | frontend           | No      | Yes      | Firebase messaging sender ID                                                                 |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | frontend           | No      | Yes      | Firebase app ID                                                                              |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`      | frontend           | No      | No       | Firebase Analytics measurement ID                                                            |
| `NEXT_PUBLIC_APP_URL`                      | frontend           | No      | Yes      | Public app URL (e.g., `https://app.example.com`)                                             |
| `NEXT_PUBLIC_APP_NAME`                     | frontend           | No      | Yes      | App display name                                                                             |
| `NEXT_PUBLIC_BACKEND_API_BASE_URL`         | frontend           | No      | No       | Backend base URL for manual benchmark UI calls (default local fallback in code)              |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`      | frontend + backend | **Yes** | Yes      | Base64-encoded service account JSON                                                          |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR`        | frontend           | No      | No       | Set `true` to use local emulators                                                            |
| `FIREBASE_PROJECT_ID`                      | backend            | No      | Yes      | Firebase project ID                                                                          |
| `USE_EMULATOR`                             | backend            | No      | No       | Set `true` to use local emulators                                                            |
| `FIRESTORE_EMULATOR_HOST`                  | backend            | No      | No       | Firestore emulator address                                                                   |
| `FIREBASE_AUTH_EMULATOR_HOST`              | backend            | No      | No       | Auth emulator address                                                                        |
| `NODE_ENV`                                 | backend            | No      | No       | `development` or `production`                                                                |
| `PORT`                                     | backend            | No      | No       | Local port for the Express server                                                            |
| `GEMINI_API_KEY`                           | backend            | **Yes** | No       | API key for live benchmark runs against Gemini                                               |
| `GEMINI_MODEL`                             | backend            | No      | No       | Gemini model for benchmark runs and chat generation (default: `gemini-2.5-flash`)            |
| `GEMINI_EMBEDDING_MODEL`                   | backend            | No      | No       | Gemini embedding model for knowledge ingestion and retrieval (default: `text-embedding-004`) |
| `GEMINI_ENDPOINT`                          | backend            | No      | No       | Gemini API endpoint override (default Google Generative Language API)                        |
| `GEMINI_ENABLE_GOOGLE_SEARCH`              | backend            | No      | No       | Set `false` to disable Gemini Google Search grounding for chat requests                      |
| `GEMINI_ENABLE_CHECKER_WEB_SEARCH`         | backend            | No      | No       | Set `false` to disable web grounding for `contract-checker` and `job-checker`                |
| `BENCHMARK_PRICE_INPUT_PER_1K_USD`         | backend            | No      | No       | Input token price used for benchmark cost metrics                                            |
| `BENCHMARK_PRICE_OUTPUT_PER_1K_USD`        | backend            | No      | No       | Output token price used for benchmark cost metrics                                           |
| `BENCHMARK_REQUEST_DELAY_MS`               | backend            | No      | No       | Delay between benchmark calls to reduce burst rate-limits                                    |
| `GEMINI_RETRY_MAX_ATTEMPTS`                | backend            | No      | No       | Max retry attempts for 429/5xx Gemini responses                                              |
| `GEMINI_RETRY_BASE_DELAY_MS`               | backend            | No      | No       | Base retry delay (exponential backoff start)                                                 |
| `GEMINI_RETRY_MAX_DELAY_MS`                | backend            | No      | No       | Max retry delay cap in milliseconds                                                          |
| `SUPABASE_URL`                             | backend            | No      | No       | Supabase project URL for the knowledge retrieval adapter                                     |
| `SUPABASE_ANON_KEY`                        | backend            | No      | No       | Optional low-privilege Supabase key for future read-only clients                             |
| `SUPABASE_SERVICE_ROLE_KEY`                | backend            | **Yes** | No       | Service role key used by the backend retrieval adapter                                       |
| `API_KEY_RATE_LIMIT_PER_MIN`               | backend            | No      | No       | Per API key rate limit for `/api/v1/*` protected routes (default `60`)                       |
| `API_KEY_CACHE_TTL_SECONDS`                | backend            | No      | No       | In-process cache TTL for API key Firestore lookups (default `60`)                            |
| `PUBLIC_API_BASE_URL`                      | backend            | No      | No       | Optional OpenAPI `servers[0].url` (e.g. Functions URL ending in `/api`)                      |
| `STITCH_API_KEY`                           | root               | **Yes** | No       | Google Stitch API key (for Claude Code MCP)                                                  |

## Generating the Service Account Key (Base64)

1. Go to **Firebase Console → Project Settings → Service Accounts**
2. Click **Generate new private key** — save the JSON file securely
3. Convert to base64:

   ```bash
   # macOS / Linux
   base64 -w 0 service-account.json

   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
   ```

4. Paste the result as `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`
5. Delete the JSON file — it is now encoded in the env var

**Never commit the service account JSON or the base64 string to version control.**

## Production Secrets (GitHub Actions)

Add these as repository secrets in **GitHub → Settings → Secrets → Actions**:

- All `NEXT_PUBLIC_FIREBASE_*` variables
- `NEXT_PUBLIC_APP_NAME`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`
- `FIREBASE_CI_TOKEN` (get via `firebase login:ci`)

## Adding a New Variable

Use the `/add-env-var` Claude Code skill to add new environment variables consistently.
