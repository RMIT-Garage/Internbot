# CLAUDE.md — interbotRAG

This file provides full context for Claude Code. Read it before making any changes.

---

## Project Overview

**Type:** RAG + AI microservice for the Internbot capstone (RMIT).
**Purpose:** FAQ RAG, job checker, and contract checker APIs; Supabase/pgvector knowledge; optional admin/demo Next.js UI. Internbot proxies student/coordinator chat to this service via `RAG_SERVICE_URL`.
**Author:** Duc Gia Tin Huynh (s3962053).
**Sibling repo:** [Internbot](https://github.com/giatinhuynh/Internbot).  
**Handover:** [docs/HANDOVER.md](docs/HANDOVER.md).

---

## Tech Stack

| Layer              | Technology                                                                         |
| ------------------ | ---------------------------------------------------------------------------------- |
| Frontend framework | Next.js 16 (App Router, React 19)                                                  |
| Language           | TypeScript 5 — strict mode                                                         |
| Styling            | Tailwind CSS v4 (CSS-first config, no `tailwind.config.js`)                        |
| UI components      | Raw Tailwind (shadcn can be added per project)                                     |
| Backend            | Firebase Cloud Functions v2 (Express fat-lambda)                                   |
| Database           | Firestore                                                                          |
| Auth               | Firebase Authentication                                                            |
| Storage            | Firebase Cloud Storage                                                             |
| Package manager    | pnpm workspaces — **always use pnpm, never npm or yarn**                           |
| Testing            | Vitest + Testing Library (frontend) · Vitest + supertest (backend)                 |
| Git hooks          | Lefthook (commit-msg: Conventional Commits · pre-commit: lint + format + gitleaks) |
| Infrastructure     | Terraform (GCP + Firebase)                                                         |
| CI/CD              | GitHub Actions                                                                     |

---

## Repository Structure

```
/
├── frontend/          Next.js 16 App Router (Firebase App Hosting)
├── backend/           Cloud Functions v2 Express fat-lambda
├── infrastructure/    Terraform (Firebase + GCP)
├── firebase/          Firestore rules, Storage rules, indexes
├── docs/              Architecture and conventions docs
├── scripts/           Utility scripts (validate-placeholders, migrations)
└── .claude/           Claude Code harness (agents, skills, MCP, settings, hooks)
```

---

## MCP Servers

Run `/mcp` in Claude Code to view and configure. Three servers are pre-configured:

| Server       | Purpose                                                                              | Setup                          |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------ |
| **context7** | Up-to-date library docs (Next.js, Firebase, Tailwind, etc.)                          | No auth needed                 |
| **firebase** | 30+ Firebase tools — deploy rules, query Firestore, manage auth users                | Run `firebase login`           |
| **stitch**   | Google Stitch design-to-code — fetch design tokens, screen code from Stitch projects | Set `STITCH_API_KEY` in `.env` |

**Usage tips:**

- Say "use context7" when asking about library APIs to get current docs
- Use the Firebase MCP to inspect Firestore data or deploy rules without leaving Claude Code
- Use the Stitch MCP to import UI designs: "fetch the design tokens from my Stitch project"

**Nested instructions** are loaded automatically when editing files in a package:

- `frontend/CLAUDE.md` — Next.js 16, App Router, Server Components, auth flow, design reference
- `backend/CLAUDE.md` — Express fat-lambda, route pattern, error handling, testing

---

## Sub-agents

Sub-agents run in their own isolated context with a tailored system prompt. Claude delegates to them automatically, or you can invoke them by name:

| Agent               | Description                                                                                                                               | Model  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `doc-auditor`       | Audits skills, docs, and CLAUDE.md for drift against the actual codebase. Use before a PR or after a major refactor.                      | Opus   |
| `security-reviewer` | Audits staged changes for auth, input validation, Firestore rules, secret handling, and architecture violations. Use before opening a PR. | Opus   |
| `test-writer`       | Writes Vitest unit tests for a given file matching project conventions (supertest for backend, Testing Library for frontend).             | Sonnet |

**Usage examples:**

- "Use the security-reviewer agent to audit my staged changes before I open this PR"
- "Use the doc-auditor agent to check if the skills are still accurate"
- "Use the test-writer agent to write tests for `backend/src/routes/health.ts`"

---

## Available Skills

Run these with `/skill-name` in Claude Code:

| Skill | Description |
| ----- | ----------- |

**Scaffolding**

| Skill                  | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| `/new-feature`         | Scaffold a feature module (types, hook, Server Actions, component) |
| `/new-page`            | Create a Next.js App Router page in the correct route group        |
| `/new-component`       | Create a React component (Server or Client) with typed props       |
| `/firebase-collection` | Add a typed Firestore collection (type + rules + hook + docs)      |
| `/add-auth-provider`   | Add an OAuth provider (Firebase config + sign-in button)           |
| `/add-route`           | Add a Cloud Functions Express route with tests                     |
| `/evolve-schema`       | Safely evolve a Firestore collection schema                        |
| `/add-env-var`         | Add an env var consistently across packages and docs               |

**Quality & verification**

| Skill                                     | Description                                                                         |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `/verify`                                 | Full pipeline: lint → typecheck → test → console.log scan → READY/NOT READY verdict |
| `/checkpoint create\|verify\|list [name]` | Mark stable milestones, compare against them later                                  |
| `/save-session [name]`                    | Save session state (8-section format) to `.claude/sessions/`                        |
| `/resume-session [name]`                  | Load a saved session and resume from exact stopping point                           |

**Git workflow**

| Skill          | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `/git-feature` | Gitflow: create `feature/*` branch from `develop` + draft PR    |
| `/git-hotfix`  | Gitflow: create `hotfix/*` branch from `main` + PR              |
| `/git-release` | Gitflow: create `release/*` branch, bump versions, PR to `main` |

---

## Agent Permissions

**CAN do autonomously:**

- Create feature branches from `develop` and commit/push to them
- Create draft PRs targeting `develop`
- Read, edit, and create files within the repo
- Run `pnpm` commands (lint, typecheck, test, build)
- Use MCP tools (context7, firebase, stitch)

**CANNOT do without explicit user approval:**

- Merge or close PRs
- Push to `main` or `develop` directly
- Create `release/*` or `hotfix/*` branches
- Delete branches
- Deploy to production (`firebase deploy`)
- Run `terraform apply`
- Modify CI/CD workflow files

---

## Critical Conventions

### Package manager

Always use `pnpm`. Run commands as:

- `pnpm install` (not `npm install`)
- `pnpm --filter frontend add {package}`
- `pnpm --filter backend add {package}`
- `pnpm -r lint` (run across all packages)

### TypeScript

- Strict mode is on. **Never use `any`** — use `unknown` and narrow.
- `noUncheckedIndexedAccess` is on — array index access returns `T | undefined`.
- Use `type` imports: `import type { Foo } from '...'`
- The `@/` alias maps to `frontend/src/`. Always use it — never relative paths more than one level deep.

### React / Next.js

- **Server Components by default** — all files in `app/` are Server Components unless `'use client'` is at the top.
- Add `'use client'` only when you actually need: React hooks, event handlers, or browser APIs.
- Never import `firebase/auth`, `firebase/firestore`, or `firebase/storage` in a Server Component — these are client-only SDKs.
- For server-side Firebase, always use `@/lib/firebase/admin` (imports `server-only`).
- Server Actions return `ActionResult<T>`: `{ success: boolean, error?: string, data?: T }`.
- Use `sonner` (`toast` from `sonner`) for all user-facing notifications.

### Firestore

- Every collection has a typed collection export in `frontend/src/lib/firebase/firestore.ts`.
- Every collection has security rules in `firebase/firestore.rules`.
- Every collection is documented in `docs/FIRESTORE-SCHEMA.md`.
- Always call `requireAuth()` in Server Actions before any Firestore operation.
- Use the soft-delete pattern (add `deletedAt: Timestamp`) instead of hard deletes.

### Backend (Cloud Functions)

- All routes under `/api/` are protected by `authMiddleware` — it verifies the Firebase ID token.
- Access the authenticated user via `(req as AuthenticatedRequest).uid`.
- Error handling: use `next(error)` from route handlers, never inline `res.status(500)`.
- Unit tests use supertest + mocked Firebase Admin (no real Firebase calls).

### Git

- Branch from `develop` for features, from `main` for hotfixes. Never commit directly to `main` or `develop`.
- Commit messages must follow Conventional Commits — enforced by the `commit-msg` hook.
- Use `/git-feature`, `/git-hotfix`, `/git-release` skills for branch management.

### Harness integrity

- When you change a code pattern that is documented in `.claude/skills/` or `docs/`, update those files in the same session — never let them drift.
- Skills and agents must discover files dynamically using `Glob` or `Grep` — never hardcode file lists or paths that will break when files move.

---

## What To Avoid

- `npm` or `yarn` — use `pnpm`
- `any` in TypeScript — use `unknown` + type narrowing
- `pages/` directory — this is App Router only
- `firebase/compat` — modular SDK only
- `NEXT_PUBLIC_` prefix on secret values (service account, API keys)
- Committing `.env.local` or `.env` — they are gitignored
- Committing directly to `main` or `develop`
- Inline styles — use Tailwind classes
- CSS-in-JS (styled-components, emotion) — not part of this stack

---

## Environment Variables

| File                    | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `frontend/.env.example` | Frontend env var template — copy to `frontend/.env.local` |
| `backend/.env.example`  | Backend env var template — copy to `backend/.env`         |
| `.env.example`          | Root env vars (Stitch API key) — copy to `.env`           |

See `docs/ENV-VARS.md` for the full variable reference.

---

## Running the Project

```bash
pnpm install              # Install all workspace dependencies
pnpm run validate         # Check for unreplaced template placeholders
pnpm run emulator         # Start Firebase emulators (Docker)
pnpm run dev              # Start frontend dev + emulators
pnpm run test             # Backend unit tests (no emulator needed)
pnpm run test:component   # Frontend unit tests
pnpm run test:all         # All tests
pnpm run lint             # ESLint across all packages
pnpm run typecheck        # TypeScript check across all packages
```

---

## Handover and new deployment

Deploying on a new Firebase + Supabase account or connecting a new [Internbot](https://github.com/giatinhuynh/Internbot) instance:

1. Follow [docs/HANDOVER.md](docs/HANDOVER.md) (Day 1 timeline, secrets, ingest, `RAG_SERVICE_URL` on Internbot).
2. Set `.firebaserc` to your Firebase project id.
3. Update `frontend/.env.example` / GitHub secrets for `NEXT_PUBLIC_APP_NAME` if rebranding the demo UI.
4. Confirm `backend/src/index.ts` region (`australia-southeast1`) matches your deployment.
5. Run `pnpm run validate` before the first deploy commit.
