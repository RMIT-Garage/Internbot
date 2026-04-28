# Garage Boilerplate

> Opinionated Next.js + Firebase monorepo for tech consultancy client projects.

## Stack

| | |
|-|-|
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind v4 |
| **Backend** | Firebase Cloud Functions v2 · Express · Clean Architecture · TypeScript |
| **Database** | Firestore |
| **Auth** | Firebase Authentication (Email/Password + Google OAuth) |
| **Storage** | Firebase Cloud Storage |
| **Infrastructure** | Terraform (Firebase + GCP) |
| **Package manager** | pnpm workspaces |
| **Testing** | Vitest · Testing Library · supertest |

## Quick Start

### First time? Do this in order

| # | Action |
|---|--------|
| 1 | Install **Node.js 22**, **pnpm** (`npm install -g pnpm`), and **Docker Desktop**. Keep Docker **running**. |
| 2 | Clone the repo and open a terminal **in the project root** (the folder that contains `package.json`). |
| 3 | Run **`pnpm run bootstrap`**. It will: install dependencies; create `frontend/.env.local`, `backend/.env`, and root `.env` **only if they are missing** (from each `*.env.example`); build and start the **Firebase emulators** in Docker. |
| 4 | **Configure Firebase** in the console and in your editor. Follow **[§ 4](#4-set-up-firebase)** for the console checklist, then **[What to put in your env files](#what-to-put-in-your-env-files-and-emulator-toggles)** for every variable and the **`true` / `false`** emulator switches. |
| 5 | Set emulator mode to **`true`** on both sides (see toggle table in that section), or **`false`** if you want the real Firebase project instead. |
| 6 | Run **`pnpm run dev`** → [http://localhost:3000](http://localhost:3000). Emulator UI → [http://localhost:4000](http://localhost:4000). |

**Before step 6:** `frontend/.env.local` must include every **required** `NEXT_PUBLIC_FIREBASE_*` value from your Firebase **web app** config (see [Firebase web app config](#firebase-web-app-config)). `pnpm run bootstrap` may create the file from `frontend/.env.example` with **empty** placeholders—you still have to paste real values. If any of those keys are blank, the app fails at runtime (for example `auth/invalid-api-key`) **even when** `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`. Restart the dev server after changing `NEXT_PUBLIC_*` variables.

If something fails, check **[Troubleshooting (emulators)](#troubleshooting-emulators)**.

#### Prefer manual commands instead of `bootstrap`?

```bash
git clone https://github.com/your-org/garage-boilerplate my-project
cd my-project
pnpm install
cp frontend/.env.example frontend/.env.local   # if you do not have .env.local yet
cp backend/.env.example backend/.env           # if you do not have .env yet
cp .env.example .env                            # optional (Stitch MCP)
pnpm run emulator:setup                         # Docker: build + start emulators
```

Then continue from **§ 4** and use **`pnpm run emulator`** on later days instead of `emulator:setup` unless you changed `docker/firebase-emulator/Dockerfile` or `docker/firebase-emulator/firebase.json`.

### Prerequisites (full list)

- Node.js 22 LTS
- pnpm (`npm install -g pnpm`)
- Docker Desktop or Docker Engine (for Firebase emulators)
- gitleaks (`brew install gitleaks` / `scoop install gitleaks`) — required for pre-commit secret scanning
- Terraform ≥ 1.10 (optional, for infra provisioning)
- Firebase CLI (optional on your machine — see [Firebase CLI (host)](#firebase-cli-host-optional) below; Docker emulators do not require it)

### 4. Set up Firebase

> **This section is LOCAL DEVELOPMENT ONLY.** CI/CD uses OIDC + Workload Identity Federation — no service account JSON is stored in GitHub Secrets. If you are only running emulators via Docker (`pnpm run dev`), you can **skip steps 5-6 below** (set `USE_EMULATOR=true` in `backend/.env` and the SA key is not needed).

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** → Email/Password + Google
3. Create a **Firestore** database (start in test mode)
4. Enable **Cloud Storage**
5. (Non-emulator local dev only) Go to **Project Settings → Service Accounts** → Generate a new private key
6. (Non-emulator local dev only) Convert that JSON to base64 and set `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` in both `frontend/.env.local` and `backend/.env`:

```bash
# macOS / Linux
base64 -w 0 service-account.json

# Windows PowerShell (use single quotes around the path)
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\to\service-account.json'))
```

7. Register a **web app** in Firebase (Project settings → Your apps) if you have not already—you need its config for the `NEXT_PUBLIC_FIREBASE_*` variables below.

### Firebase web app config

Do this **before** the first successful `pnpm run dev` (after you have `frontend/.env.local`).

1. Open [Firebase Console](https://console.firebase.google.com/) → select your project.
2. **Project settings** (gear icon) → **Your apps**.
3. Under **Web apps**, select your app, or **Add app** → **Web** (`</>`) and complete registration (Google Analytics is optional).
4. In **SDK setup and configuration**, use the **npm / modular** snippet Firebase shows: the `firebaseConfig` object is what you need. (This repo already installs `firebase` and initializes it in code—you only copy values into env vars, you do not paste that snippet into the source tree.)
5. Set each row in **`frontend/.env.local`** from the matching `firebaseConfig` property:

| Env variable | `firebaseConfig` field |
|----------------|-------------------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `projectId` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `storageBucket` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `messagingSenderId` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `appId` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `measurementId` (optional; omit if Analytics is off) |

6. Save the file and **restart** the Next.js dev server so `NEXT_PUBLIC_*` changes are applied.

### What to put in your env files (and emulator toggles)

Use the same **project id** everywhere: `FIREBASE_PROJECT_ID` (backend) and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (frontend). Docker emulators read `FIREBASE_PROJECT_ID` from `backend/.env`.

**Where values come from**

- **`NEXT_PUBLIC_FIREBASE_*`**, **`NEXT_PUBLIC_APP_*`**: Same as [Firebase web app config](#firebase-web-app-config) above—the web app `firebaseConfig` in Project settings → **Your apps**.
- **`FIREBASE_SERVICE_ACCOUNT_KEY_BASE64`**: Project settings → **Service accounts** → generate JSON → convert to base64 (commands in §4 above). Put the **same** string in **both** `frontend/.env.local` and `backend/.env`.

#### `frontend/.env.local`

| Variable | Required | What to enter |
|----------|----------|----------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Web app config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | e.g. `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Same as `FIREBASE_PROJECT_ID` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Use the exact `storageBucket` from the web config (often `your-project.appspot.com` or `your-project.firebasestorage.app`) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Web app config |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | Analytics (if enabled) |
| `NEXT_PUBLIC_APP_URL` | Yes | Local dev: `http://localhost:3000` |
| `NEXT_PUBLIC_APP_NAME` | Yes | Display name for the app |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | Yes | Base64 service account JSON (server-side in Next; never prefix with `NEXT_PUBLIC_` for secrets—this is used only in server context) |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | Toggle | **`true`** = browser SDK uses Auth/Firestore/Storage **emulators** on localhost. **`false`** or omit = use **production** Firebase. |

#### `backend/.env`

| Variable | Required | What to enter |
|----------|----------|----------------|
| `FIREBASE_PROJECT_ID` | Yes | Firebase / GCP project id |
| `FIREBASE_SERVICE_ACCOUNT_KEY_BASE64` | Yes | Same base64 as frontend |
| `USE_EMULATOR` | Toggle | **`true`** = Admin SDK uses **Firestore + Auth emulators** (`FIRESTORE_EMULATOR_HOST` / `FIREBASE_AUTH_EMULATOR_HOST`). **`false`** = **production** Firebase. |
| `FIRESTORE_EMULATOR_HOST` | When emulators | Default in example: `localhost:8080` (Docker publishes Firestore emulator here) |
| `FIREBASE_AUTH_EMULATOR_HOST` | When emulators | Default in example: `localhost:9099` |
| `NODE_ENV` | No | Usually `development` locally |
| `PORT` | No | Default `5001` for local API |

#### Local emulators vs real Firebase

| Mode | `frontend/.env.local` | `backend/.env` |
|------|------------------------|----------------|
| **Docker emulators** (typical local dev) | `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` | `USE_EMULATOR=true` |
| **Real Firebase** (staging / prod project) | `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false` or remove the line | `USE_EMULATOR=false` |

Restart the dev server after changing toggles. Full variable list: [docs/ENV-VARS.md](docs/ENV-VARS.md).

#### Root `.env` (optional)

Only for Claude Code **Stitch MCP**: copy `.env.example` → `.env` and set `STITCH_API_KEY` if you use it. Not required for the web app.

### Firebase CLI (host, optional)

Emulators in this repo run **inside Docker**; you do not need `firebase login` in the container.

Install the CLI on your workstation if you use **`firebase deploy`** or other project commands. Without `.firebaserc`, pass `--project <your-project-id>` explicitly when needed:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --project your-project-id
```

If you run **`firebase emulators:start` directly on the host** (not the Docker setup below), enable the web frameworks experiment once (the Docker entrypoint does this automatically for the container):

```bash
firebase experiments:enable webframeworks
```

### 5. Build and start the emulators (Docker)

If you already ran **`pnpm run bootstrap`**, the emulator image was built and the container was started—you can skip this section until you change `docker/firebase-emulator/Dockerfile` or `docker/firebase-emulator/firebase.json`.

**First time** (manual path), or after changing `docker/firebase-emulator/Dockerfile` or `docker/firebase-emulator/firebase.json`:

```bash
pnpm run emulator:setup
```

Same thing via shell helpers (from repo root):

- **Bash**: `chmod +x scripts/setup-local-emulators.sh` once, then `./scripts/setup-local-emulators.sh`
- **PowerShell**: `.\scripts\setup-local-emulators.ps1`

**Every day** (no rebuild unless Dockerfiles changed):

```bash
pnpm run emulator
```

The Emulator UI is at [http://localhost:4000](http://localhost:4000). `docker-compose.yml` bind-mounts `docker/firebase-emulator/firebase.json` and `docker/firebase-emulator/firebase/` so the container always matches your repo, and reads `FIREBASE_PROJECT_ID` from `backend/.env`.

To point the app at emulators vs production Firebase, set the **`true` / `false`** toggles in [What to put in your env files](#what-to-put-in-your-env-files-and-emulator-toggles).

#### Troubleshooting (emulators)

| Symptom | What to try |
|--------|-------------|
| Emulator starts against the wrong project id | Set `FIREBASE_PROJECT_ID` in `backend/.env`. Keep it aligned with `NEXT_PUBLIC_FIREBASE_PROJECT_ID` in `frontend/.env.local`. |
| `webframeworks` / cannot emulate web framework | Rebuild the image (`pnpm run emulator:setup`). On the **host** only: `firebase experiments:enable webframeworks`. |
| Java / JDK before 21 | Rebuild the image; `docker/firebase-emulator/Dockerfile` installs Temurin 21. |
| Missing `storage.rules` / `firestore.rules` | Ensure `docker/firebase-emulator/firebase/` exists and compose mounts it (see `docker-compose.yml`). |
| Browser shows no data at port 4000 | `docker/firebase-emulator/firebase.json` sets emulator `host` to `0.0.0.0` for Docker port mapping; rebuild after changing it. |
| PowerShell base64 error | Use a single-quoted path: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\service-account.json'))` |
| Container removed while exporting data | `docker compose down` waits for `--export-on-exit`; wait a few seconds or increase `stop_grace_period` on `firebase-emulators` if exports are slow. |

#### Troubleshooting (`pnpm run dev` / Next.js)

| Symptom | What to try |
|--------|-------------|
| `'next' is not recognized`, `Command "next" not found`, or `Could not resolve the "next" package` | From the **repo root**, run **`pnpm install`**. The root **`package.json`** lists **`next`** as a devDependency so the framework is always installed at the workspace root (common pnpm monorepo pattern). `.npmrc` sets **`node-linker=hoisted`**. If it still fails, delete all **`node_modules`** folders, then **`pnpm install`**. The frontend **`scripts/run-next.cjs`** locates Next under `node_modules` / `.pnpm` and runs **`dist/bin/next`** without relying on `.bin` shims. |

### 6. Start development

```bash
pnpm run dev
```

Opens the frontend and starts emulators together. Visit [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
/
├── frontend/          Next.js 16 App Router
│   └── src/
│       ├── app/       Pages (route groups: (auth), (dashboard))
│       ├── components/ UI components (layout, auth, shared)
│       ├── features/  Feature modules (one folder per business domain)
│       ├── lib/       Firebase client/admin (lazy init), validations, utils
│       ├── hooks/     Custom React hooks
│       ├── providers/ React context providers
│       ├── actions/   Next.js Server Actions
│       └── types/     TypeScript type definitions
├── backend/           Cloud Functions v2 — Clean Architecture
│   └── src/
│       ├── domain/        Entities, DomainErrors, repository interfaces
│       ├── application/   Actor type, TokenVerifier port
│       ├── infrastructure/ Firebase Admin, Firestore converters, UnitOfWork
│       └── api/           Express app, routes, middleware, RFC 9457 errors
├── e2e/               Playwright browser tests
├── infrastructure/    Terraform (Firebase + GCP)
│   └── modules/       Terraform modules (firebase-project, auth, firestore, storage, github-oidc)
├── docker/
│   └── firebase-emulator/
│       ├── Dockerfile
│       ├── firebase.json
│       └── firebase/   Firestore rules, Storage rules, indexes
├── docs/              Architecture and conventions docs
└── .claude/           Claude Code harness (agents, skills, MCP, hooks)
```

---

## Backend Architecture

The backend follows Clean Architecture — dependencies always point inward:

```
domain ← application ← infrastructure ← api
```

| Layer | Contents |
|-------|----------|
| `domain/` | Pure TypeScript — `DomainError` subclasses with codes, `IRepository`/`IUnitOfWork` interfaces |
| `application/` | `Actor { uid, email, claims }`, `TokenVerifier` port (DI contract) |
| `infrastructure/` | Firebase Admin singleton, `firebaseTokenVerifier`, `zodConverter`, `FirestoreUnitOfWork` |
| `api/` | `createApp()` composition root, RFC 9457 error format, DI auth middleware |

Architecture boundary tests run on every PR and enforce the dependency rule at CI time.

---

## Security

Security is enforced in layers — each is independent:

| Layer | Mechanism |
|-------|-----------|
| Pre-commit | gitleaks secret scan |
| Claude Code | Deny rules, Pre/PostToolUse hooks (blocks `any`, `firebase deploy`, credential reads) |
| HTTP | helmet headers, CORS policy, rate limiting (300 req/15min), 1mb body cap |
| Auth | Firebase token verification, HttpOnly session cookies |
| API | Zod input validation with `.strict()`, actor-based access control |
| Data | Firestore rules — default deny, field allowlists, soft-delete guard |
| CI | gitleaks action + `pnpm audit --audit-level=high` on every PR |
| Dependencies | Dependabot weekly PRs for the root pnpm workspace and Actions |

See [docs/SECURITY.md](docs/SECURITY.md) for the full reference.

---

## Commands

```bash
pnpm run bootstrap        # First-time: install deps, env templates, emulator Docker setup
pnpm run dev              # Frontend dev + emulators (Docker)
pnpm run build            # Build all packages
pnpm run test             # Backend unit tests (no emulator)
pnpm run test:integration # Backend integration tests (Docker emulators)
pnpm run test:component   # Frontend unit tests
pnpm run test:e2e         # Playwright E2E (auto-starts local frontend)
pnpm run test:all         # All tests
pnpm run lint             # ESLint across all packages
pnpm run format           # Prettier across all packages
pnpm run typecheck        # TypeScript check across all packages
pnpm run emulator         # Start Firebase emulators (Docker)
pnpm run emulator:setup   # Build emulator image + start (first time / after Dockerfile or firebase.json changes)
pnpm run emulator:down    # Stop emulators
pnpm run validate         # Check for unreplaced template placeholders
pnpm run hooks            # Re-install Lefthook git hooks
```

---

## Git Workflow (Gitflow)

| Branch | Purpose |
|--------|---------|
| `main` | Production |
| `develop` | Integration |
| `feature/*` | New features → develop |
| `release/*` | Release prep → main + develop |
| `hotfix/*` | Urgent fixes → main + develop |

Use the Claude Code skills to manage branches: `/git-feature`, `/git-hotfix`, `/git-release`.

See [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) for merge strategy and commit message rules.

---

## Claude Code Setup

This project includes a Claude Code harness with pre-configured MCP servers, sub-agents, skills, and enforcement hooks.

### MCP Servers

Run `/mcp` in Claude Code to authenticate:

| Server | Purpose | Auth |
|--------|---------|------|
| context7 | Up-to-date library docs (Next.js, Firebase, Tailwind, etc.) | None |
| firebase | Firebase CLI tools — deploy rules, query Firestore, manage auth | `firebase login` |
| stitch | Google Stitch design-to-code — fetch tokens and screen code | `STITCH_API_KEY` in `.env` |

### Recommended Plugins (AI-First Teams)

This repo already includes a strong default harness. From community recommendations, these are the most practical additions for production teams.

#### Core essentials (recommended default)

| Plugin / MCP | Why it is useful | From your list |
|---|---|---|
| `claude-plugins-official` | Curated official plugin directory with safer defaults | #36 |
| `context7` | Up-to-date framework/library docs in-agent | #9 |
| `chrome-devtools-mcp` | Real browser debugging and UI validation | #13 |
| `firebase-tools` | Firebase operations directly from agent workflows | #80 |

#### High-value optional plugins (install by need)

| Use case | Plugin / MCP | From your list |
|---|---|---|
| Agent memory | `mem0` or `claude-mem` | #8 / #10 |
| Planning + task orchestration | `claude-task-master` | #18 |
| Prompt/agent evaluation and red-teaming | `promptfoo` | #27 |
| Better web search/crawl | `exa-mcp-server` | #83 |
| Structured spec-driven workflow | `spec-workflow-mcp` | #88 |
| Security skill packs | `skills` (Trail of Bits security set) | #81 |
| Team multi-agent orchestration | `oh-my-claudecode` | #19 |
| Harness optimization suite | `everything-claude-code` | #2 |
| Harness bootstrap/templates | `claude-code-templates` | #21 |
| Parallel AI worktree workflows | `worktrunk` | #82 |
| Context-efficient review mapping | `code-review-graph` | #70 |

#### Good skill libraries (optional, curated import only)

- `skills` (official/public skills repos) — #5, #49
- `awesome-claude-code-subagents` — #35
- `antigravity-awesome-skills` — #15

Use a whitelist approach: import only skills you actively use and review them before enabling in client repos.

#### Selection criteria for this boilerplate

- Prefer plugins with clear maintenance activity and real production usage.
- Prefer tools that improve correctness (docs, testing, browser validation, security) before productivity extras.
- Keep the default set small; add optional plugins per-project.
- Use least-privilege credentials (read-only first, then escalate if required).

**Important:** plugin configs can be pre-added in the repo, but each developer still completes their own local auth/secrets setup.

### Sub-agents

| Agent | When to use |
|-------|-------------|
| `security-reviewer` | Before opening a PR — audits staged changes for auth, validation, Firestore rules, secrets |
| `doc-auditor` | After a major refactor — checks skills and docs for drift against the codebase |
| `test-writer` | Write Vitest tests for a route, Server Action, or React hook |

### Available Skills

**Scaffolding**

| Skill | Description |
|-------|-------------|
| `/new-feature` | Scaffold a feature module (types, hook, Server Actions, component) |
| `/new-page` | Create an App Router page in the correct route group |
| `/new-component` | Create a React component (Server or Client) with typed props |
| `/firebase-collection` | Add a typed Firestore collection (type + rules + hook + docs) |
| `/add-auth-provider` | Add an OAuth provider (Firebase config + sign-in button) |
| `/add-route` | Add a Cloud Functions Express route with tests |
| `/evolve-schema` | Safely evolve a Firestore collection schema |
| `/add-env-var` | Add an env var consistently across packages and docs |

**Quality & verification**

| Skill | Description |
|-------|-------------|
| `/verify` | Full pipeline: lint → typecheck → test → console.log scan → READY/NOT READY |
| `/checkpoint` | Mark stable milestones and compare against them later |
| `/save-session` | Save session state to `.claude/sessions/` |
| `/resume-session` | Load a saved session and resume from exact stopping point |

**Git workflow**

| Skill | Description |
|-------|-------------|
| `/git-feature` | Gitflow: create `feature/*` from `develop` + draft PR |
| `/git-hotfix` | Gitflow: create `hotfix/*` from `main` + PR |
| `/git-release` | Gitflow: create `release/*`, bump versions, PR to `main` |

---

## Documentation

| Topic | Link |
|-------|------|
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Backend | [docs/BACKEND.md](docs/BACKEND.md) |
| Frontend | [docs/FRONTEND.md](docs/FRONTEND.md) |
| Infrastructure | [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| Git workflow | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| CI/CD | [docs/CI-CD.md](docs/CI-CD.md) |
| Environment variables | [docs/ENV-VARS.md](docs/ENV-VARS.md) |
| Testing | [docs/TESTING.md](docs/TESTING.md) |
| Firestore schema | [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md) |
| Design system | [docs/DESIGN.md](docs/DESIGN.md) |

---

## Deployment

See [docs/CI-CD.md](docs/CI-CD.md) for the full deployment pipeline.

**Short version:**
- **Backend** → Firebase Cloud Functions (`deploy_targets: functions,firestore,storage`)
- **Infrastructure** → Terraform (GCP project, Firestore DB, Auth, Storage bucket, GitHub WIF/OIDC)
- **Auth**: OIDC/Workload Identity Federation — no stored service account keys
- **Frontend hosting**: not deployed from this repo yet

Deploys:
- Push to `develop` → `deploy-dev.yml` runs CI → terraform apply → firebase deploy → `internbot-dev-ae3a3`
- Push to `main` → `deploy-prod.yml` runs CI → terraform apply → firebase deploy → `internbot-prod`

---

## Forking for a Client Project

See the "Forking for a New Client Project" section in [CLAUDE.md](CLAUDE.md).
