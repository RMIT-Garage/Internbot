# Internbot

> Internship workflow platform for RMIT students and coordinators — profile, semester enrolment, opportunities, applications, offer review, notifications, support tickets, and AI-assisted guidance.

**Repository:** [github.com/giatinhuynh/Internbot](https://github.com/giatinhuynh/Internbot)  
**AI service (separate repo):** [interbotRAG](https://github.com/giatinhuynh/interbotRAG) — FAQ RAG and document checkers proxied by this backend.

## Team

| Name | Student ID |
|------|------------|
| Duc Gia Tin Huynh | s3962053 |
| Edelyne Keisha Tjhin | s4190528 |
| Amantha Mampitiya Arachchige | s3992315 |
| Heethasha Sandeep Kumar | s3906349 |
| Dan Dang | s4059981 |

---

## Codebase guide for newcomers

Read this section first if you are joining the project. Detailed conventions live in `docs/`; this is the map of **how the repo is organized and how data flows**.

### What the product does

Internbot runs the internship lifecycle in one web app:

| Role | Main journeys |
|------|----------------|
| **Student** | Sign up (RMIT student email) → onboarding (profile, credits, semester) → browse opportunities → apply → upload offer → track status → FAQ advisor, tickets |
| **Coordinator** | Manage semesters and opportunities → verify student-submitted roles → review applications and offers → notifications and support tickets → optional AI tools (contract/job check, assistant chat) |

Business rules, API shapes, and status enums are defined in [docs/WORKFLOW-API-SPEC.md](docs/WORKFLOW-API-SPEC.md). Implementation progress is tracked in [docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md](docs/WORKFLOW-API-IMPLEMENTATION-PLAN.md).

### Mental model: one SPA, one API, no client Firestore

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser — Next.js static SPA (frontend/)                                │
│  • Firebase Auth only (sign-in, ID token)                                │
│  • apiFetch('/api/v1/...') for ALL domain data                           │
│  • Never imports firebase/firestore or firebase/storage for domain data  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS  Authorization: Bearer <Firebase ID token>
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Firebase Hosting — serves frontend/out; rewrites /api/** → function    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Cloud Function `api` (backend/) — Express app                           │
│  • authMiddleware → platform user (users/{id} via userIdentities)        │
│  • CQRS command/query handlers → Firestore + Storage (Admin SDK)         │
│  • advisor routes → HTTP proxy to interbotRAG (RAG_SERVICE_URL)          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                ▼
                    Firestore · Cloud Storage · (optional) interbotRAG
```

**Identity:** The app uses platform user ids (`users/{id}`), not raw Firebase UIDs in APIs. Students are **JIT-provisioned** on first verified `GET /api/v1/users/me`. Coordinators are **admin-provisioned** (Auth user + Firestore doc with `role: coordinator`) — they cannot self-register through the public sign-up flow.

### Monorepo layout

| Path | What lives here |
|------|-----------------|
| `frontend/` | Next.js 16 App Router, static export, student + coordinator UI |
| `backend/` | Cloud Functions v2, Express, domain + application + infrastructure |
| `e2e/` | Playwright browser tests against local dev |
| `infrastructure/` | Terraform — Firebase/GCP, OIDC for GitHub Actions, Hosting web-config secret |
| `docker/firebase-emulator/` | Dockerized Auth, Firestore, Storage, Functions emulators |
| `docs/` | Product spec, architecture, handover, testing |
| `scripts/` | `bootstrap.js`, placeholder validation |
| `.github/workflows/` | CI, deploy-dev/prod, Terraform |

Package manager: **pnpm workspaces** (always run commands from repo root unless noted).

### Domain concepts (backend / Firestore)

| Concept | Meaning |
|---------|---------|
| **User** | Student or coordinator; `users/{id}` with `role`, optional `studentProfile` |
| **Semester** | Coordinator-managed intake period; gating for enrolment and opportunities |
| **Opportunity** | Job listing (pre-approved or custom); may need coordinator verification |
| **Internship** | Student application to an opportunity; offer upload and review workflow |
| **Notification** | In-app events for students/coordinators |
| **Ticket** | Student → coordinator support thread |
| **Activity** | Audit-style feed on semesters, opportunities, internships |

Schema summary: [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md).

### Frontend (`frontend/`)

**Build mode:** `output: 'export'` — no SSR, no Server Actions, no `middleware.ts`. Anything that needs the signed-in user must be a **client component** (`'use client'`).

#### Routing

Routes are organized by **role**, not only by route groups:

| Area | Path prefix | Examples |
|------|-------------|----------|
| Marketing | `/` | Landing |
| Auth | `(auth)/` | `/login`, `/register`, `/verify-email` |
| Onboarding | `(onboarding)/onboarding/` | Personal, academic, credits, semester steps |
| Student app | `student/` | `/student/dashboard`, `/student/jobs`, `/student/advisor`, applications, opportunities |
| Coordinator app | `coordinator/` | `/coordinator/dashboard`, semesters, jobs, contracts, tickets, assistant |
| Legacy redirect | `dashboard/` | May redirect into role-specific home |

Student and coordinator each have their own login entry (`student/login`, `coordinator/login`).

#### Feature modules (`src/features/`)

Business UI logic is grouped by domain — prefer adding code here instead of loose files under `components/`:

| Folder | Responsibility |
|--------|----------------|
| `auth/` | Login, register, verify email, redirect helpers |
| `onboarding/` | Multi-step student onboarding wizard |
| `profile/` | Profile view/edit, `useUserProfile` |
| `advisor/` | Student FAQ chat, tickets (`useAdvisorChat`, `useTickets`) |
| `coordinator-ai/` | Coordinator assistant, job/contract checkers |

Shared chrome lives in `src/components/` (`layout/`, `student/`, `coordinator/`, `shared/`, `ui/`). **Do not hand-edit** `components/ui/` (shadcn) — regenerate via CLI.

#### Data access

- **Auth:** `@/lib/firebase/auth` + `AuthProvider` (`onAuthStateChanged`).
- **API:** `@/lib/api/client` → `apiFetch<T>(path, options)` adds `Authorization: Bearer` and uses `NEXT_PUBLIC_API_URL`.
- **Coordinator API:** some screens use `@/lib/coordinator/api.ts` (still HTTP to backend).

After login, the app calls `GET /api/v1/users/me`. `403` with `no_platform_user` → send user to `/verify-email`.

Deep dive: [docs/FRONTEND.md](docs/FRONTEND.md) · [frontend/README.md](frontend/README.md) · [frontend/CLAUDE.md](frontend/CLAUDE.md).

### Backend (`backend/`)

**Pattern:** Clean Architecture + DDD + **CQRS** + Unit of Work. Dependency rule (enforced by architecture tests):

```
domain  ←  application  ←  infrastructure  ←  api
```

| Layer | Folder | Responsibility |
|-------|--------|----------------|
| **domain** | `src/domain/` | Entities (`User`, `Semester`, …), value objects, domain errors, repository **interfaces** — no Firebase, no Zod |
| **application** | `src/application/` | `commands/` and `queries/` handlers, ports (`UnitOfWork`, `AuthorizationService`, query services) |
| **infrastructure** | `src/infrastructure/` | Firestore repositories, GCS attachments, Firebase token verifier, RAG is **not** here (proxy in api) |
| **api** | `src/api/` | Express routes, Zod request schemas, mappers to wire DTOs, `createApp()` composition root |

**Typical write path:** Route parses body → builds `XxxCommand` with `actor` → `CommandHandler.handle(cmd)` → `uow.execute` → repository saves aggregate → route returns `{ id }` or runs a follow-up query.

**Typical read path:** Route → `QueryHandler.handle(query)` → read-only query service (no `UnitOfWork` in queries).

#### HTTP surface (`/api/v1`)

Mounted in `backend/src/api/routes/index.ts`:

| Router | Domain |
|--------|--------|
| `users` | Profile, workflow, semester selection, activity |
| `semesters` | CRUD, state transitions |
| `opportunities` | Listings, verification, attachments |
| `internships` | Applications, offers, decisions |
| `notifications` | In-app notifications |
| `tickets` | Support tickets and replies |
| `advisor` | Proxy to interbotRAG (`faq-rag`, checkers) — **no Firestore** |
| `coordinator/ai` | Coordinator-facing AI endpoints |

OpenAPI: `GET /api/openapi.json` when the API is running.

Other exports in `backend/src/index.ts`: `enforceStudentEmail` (Auth blocking function), `syncAttachmentMetadata` (Storage trigger), main `api` function.

Deep dive: [docs/BACKEND.md](docs/BACKEND.md) · [backend/CLAUDE.md](backend/CLAUDE.md).

### How Internbot uses interbotRAG

Internbot does **not** embed vectors or call Gemini directly for student FAQ. `backend/src/api/routes/advisor.ts` forwards to `process.env.RAG_SERVICE_URL`:

- `POST /api/v1/advisor/chat` → RAG `feature: "faq-rag"`
- `POST /api/v1/advisor/job-check` → `job-checker`
- `POST /api/v1/advisor/contract-check` → `contract-checker`

Responses may be normalized in `normalize-faq-chat-response.ts` for the UI. Deploy and ingest FAQ content in the **interbotRAG** repo; set `RAG_SERVICE_URL` in `backend/.env` and CI (`rag_service_url` in deploy workflows).

### Tests

| Tier | Location | Needs emulator? |
|------|----------|-----------------|
| Unit (domain only) | `backend/tests/unit/domain/` | No |
| Integration (handlers) | `backend/tests/integration/application/` | Yes |
| Component (HTTP routes) | `backend/tests/component/routes/` | Yes |
| Architecture rules | `backend/tests/architecture/` | No |
| Frontend unit | `frontend/tests/unit/` | No |
| E2E | `e2e/` | Dev server + emulators |

See [docs/TESTING.md](docs/TESTING.md). Run `pnpm run test:all` from root after emulators are up.

### Suggested reading order (first week)

1. [docs/WORKFLOW-API-SPEC.md](docs/WORKFLOW-API-SPEC.md) — skim overview + statuses  
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — request/auth patterns  
3. This README → run `pnpm run bootstrap` and `pnpm run dev`  
4. Trace one student flow in the UI, then `GET /api/v1/users/me` in `backend/src/api/routes/users.ts`  
5. [docs/BACKEND.md](docs/BACKEND.md) or [docs/FRONTEND.md](docs/FRONTEND.md) depending on your task  
6. [docs/HANDOVER.md](docs/HANDOVER.md) before touching GCP deploy  

### Common tasks

| Task | Where to look |
|------|----------------|
| New API endpoint | `backend/src/api/routes/`, matching handler in `application/commands` or `queries`, [docs/BACKEND.md](docs/BACKEND.md) |
| New student/coordinator page | `frontend/src/app/student/` or `coordinator/`, feature module under `src/features/` |
| Change Firestore shape | Domain + repository + [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md) + spec |
| FAQ / AI behaviour | [interbotRAG](https://github.com/giatinhuynh/interbotRAG) repo + `advisor.ts` |
| Infra / deploy | `infrastructure/`, [docs/HANDOVER.md](docs/HANDOVER.md) |

---

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (static export) · React 19 · TypeScript · Tailwind v4 |
| Backend | Cloud Functions v2 · Express · Clean Architecture · CQRS |
| Data | Firestore · Cloud Storage (backend Admin SDK only) |
| Auth | Firebase Authentication |
| AI | interbotRAG (`RAG_SERVICE_URL`) |
| Infra | Terraform · GitHub Actions (OIDC) |
| Tooling | pnpm · Vitest · Playwright · Lefthook · gitleaks |

---

## Quick start

**Prerequisites:** Node.js 22, pnpm 10, Docker Desktop, gitleaks (`brew install gitleaks`).

```bash
git clone https://github.com/giatinhuynh/Internbot.git
cd Internbot
pnpm run bootstrap
# Edit frontend/.env.local and backend/.env (see below)
pnpm run dev
```

| URL | Purpose |
|-----|---------|
| [http://localhost:3000](http://localhost:3000) | App |
| [http://localhost:4000](http://localhost:4000) | Firebase Emulator UI |

Restart the dev server after changing any `NEXT_PUBLIC_*` variable.

### Environment setup

Align `FIREBASE_PROJECT_ID` (backend) with `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (frontend).

| Mode | `frontend/.env.local` | `backend/.env` |
|------|------------------------|----------------|
| Emulators (default) | `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` | `USE_EMULATOR=true` |
| Real Firebase project | `false` or unset | `USE_EMULATOR=false` |

Copy from `frontend/.env.example` and `backend/.env.example`. Key vars:

- **Frontend:** all `NEXT_PUBLIC_FIREBASE_*`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`
- **Backend:** `FIREBASE_PROJECT_ID`, emulator hosts; optional `RAG_SERVICE_URL` for advisor features

Full matrix: [docs/ENV-VARS.md](docs/ENV-VARS.md).

**New Firebase account / handover:** [docs/HANDOVER.md](docs/HANDOVER.md).

---

## Commands

```bash
pnpm run bootstrap        # Deps, env templates, emulator Docker
pnpm run dev              # Frontend + emulators
pnpm run build            # Frontend + backend compile
pnpm run test             # Backend unit
pnpm run test:integration # Backend + emulators
pnpm run test:component   # Frontend unit
pnpm run test:e2e         # Playwright
pnpm run test:all         # All of the above (where applicable)
pnpm run lint && pnpm run typecheck
pnpm run emulator:setup   # Rebuild emulator image
pnpm run hooks            # Lefthook
```

---

## Documentation

| Topic | Link |
|-------|------|
| **Newcomer deploy** | [docs/HANDOVER.md](docs/HANDOVER.md) |
| Workflow & API spec | [docs/WORKFLOW-API-SPEC.md](docs/WORKFLOW-API-SPEC.md) |
| Architecture | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Backend | [docs/BACKEND.md](docs/BACKEND.md) |
| Frontend | [docs/FRONTEND.md](docs/FRONTEND.md) |
| Firestore schema | [docs/FIRESTORE-SCHEMA.md](docs/FIRESTORE-SCHEMA.md) |
| Testing | [docs/TESTING.md](docs/TESTING.md) |
| Security | [docs/SECURITY.md](docs/SECURITY.md) |
| CI/CD · Infra | [docs/CI-CD.md](docs/CI-CD.md) · [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) |
| Git workflow | [docs/GIT-WORKFLOW.md](docs/GIT-WORKFLOW.md) |
| Design system | [docs/DESIGN.md](docs/DESIGN.md) |
| Agent rules | [CLAUDE.md](CLAUDE.md) |

---

## Deployment

| Branch | Environment | Firebase project (outgoing example) |
|--------|-------------|-------------------------------------|
| `develop` | Dev | `internbot-dev-ae3a3` |
| `main` | Prod | `internbot-prod` |

CI → Terraform → deploy functions + hosting. See [docs/CI-CD.md](docs/CI-CD.md) and [docs/HANDOVER.md](docs/HANDOVER.md).

---

## Troubleshooting

| Symptom | What to try |
|---------|-------------|
| `auth/invalid-api-key` | Fill `NEXT_PUBLIC_FIREBASE_*` in `frontend/.env.local`; restart dev |
| Advisor / FAQ 503 | Set `RAG_SERVICE_URL`; deploy interbotRAG |
| Emulator project mismatch | Match `FIREBASE_PROJECT_ID` and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` |
| `'next' is not recognized` | `pnpm install` from repo root |

More: [docs/HANDOVER.md § Troubleshooting](docs/HANDOVER.md#troubleshooting).

---

## License

RMIT Capstone project — see course requirements for use and distribution.
