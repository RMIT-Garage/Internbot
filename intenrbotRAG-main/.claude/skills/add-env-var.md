---
description: Add an environment variable consistently across frontend/.env.example, backend/.env.example, and docs/ENV-VARS.md. Use when a new configuration value is needed.
argument-hint: "[VAR_NAME] [frontend|backend|both]"
---

# Skill: /add-env-var

Add a new environment variable consistently across all packages and documentation.

## Step 1 — Gather requirements

Ask the user:

1. **Variable name** (e.g., `STRIPE_SECRET_KEY`)
2. **Which package(s)** — `frontend`, `backend`, or both?
3. **Is it secret?** — if yes, it must NOT have `NEXT_PUBLIC_` prefix
4. **Is it client-side safe?** — if it needs to be in browser bundles, it MUST have `NEXT_PUBLIC_` prefix
5. **Description** — what is this variable for?
6. **Example value or format** (used in .env.example comments)

## Step 2 — Files to update

### If for `frontend`:

**`frontend/.env.example`** — add with a comment:

```bash
# {Description}
{VAR_NAME}=
```

**`frontend/src/...`** — if the variable is used in code, add the access:

- Client-side: `process.env.NEXT_PUBLIC_{NAME}`
- Server-side: `process.env.{NAME}` (in Server Components, Server Actions, Route Handlers)

### If for `backend`:

**`backend/.env.example`** — add with a comment

**`backend/src/...`** — if used in code, access via `process.env.{NAME}`

### Both packages:

**`docs/ENV-VARS.md`** — add a row to the table:
| Variable | Package | Required | Description |
|---------|---------|----------|-------------|
| `{VAR_NAME}` | frontend/backend | Yes/No | {Description} |

### If it's a secret:

Add a note to `docs/SECURITY.md` about how to rotate it if compromised.

## Step 3 — Remind user

> "Add the actual value to your `.env.local` (frontend) or `.env` (backend) file — these are gitignored and never committed."
> "For production, add the variable to your Vercel/Cloud Run environment configuration."
> "For CI/CD, add it as a GitHub Actions secret."

## Checklist

- [ ] Added to the correct `.env.example` with a descriptive comment
- [ ] `NEXT_PUBLIC_` prefix used only for truly browser-safe values
- [ ] Documented in `docs/ENV-VARS.md`
- [ ] Secret variables noted in `docs/SECURITY.md`
- [ ] Code accessing the variable has a fallback or clear error if missing
