# interbotRAG

> RAG and AI assistant service for [Internbot](https://github.com/giatinhuynh/Internbot) — FAQ chat with citations, job-listing checker, and contract checker. Knowledge lives in **Supabase pgvector**; generation and embeddings use **Google Gemini**.

**Repository:** [github.com/giatinhuynh/interbotRAG](https://github.com/giatinhuynh/interbotRAG)  
**Consumer:** Internbot backend proxies student/coordinator AI calls here via `RAG_SERVICE_URL`.

## Author

| Name              | Student ID |
| ----------------- | ---------- |
| Duc Gia Tin Huynh | s3962053   |

---

## Codebase guide for newcomers

### Role in the wider system

interbotRAG is a **separate deploy** from Internbot. Production students never open this repo’s UI; they use Internbot, which calls:

```http
POST {RAG_SERVICE_URL}/api/chat/message
Content-Type: application/json

{ "feature": "faq-rag" | "job-checker" | "contract-checker", "userInput": "...", ... }
```

Internbot routes: `backend/src/api/routes/advisor.ts` in the Internbot repo.

This repo also ships a **demo/admin Next.js app** to test chat, ingest FAQ text, and manage API keys locally.

### What each `feature` does

| `feature`          | Purpose                                                                                           | Typical caller         |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------- |
| `faq-rag`          | Retrieve FAQ chunks from Supabase, optional Gemini Google Search grounding, answer with `sources` | Internbot advisor chat |
| `job-checker`      | Review a job listing (text or attachment context) for red flags                                   | Internbot + demo UI    |
| `contract-checker` | Review internship contract text                                                                   | Internbot + demo UI    |

Prompt templates and model settings live in `backend/src/application/prompts/`.

### End-to-end FAQ (RAG) flow

```text
1. Ingest (offline/CLI or admin API)
   FAQ .txt / manifest → chunkText → Gemini embeddings → Supabase knowledge_chunks

2. Chat (runtime)
   userInput → embed query → match_knowledge_chunks (RPC) → top chunks
            → Gemini generate with context → { reply, sources, webSources? }

3. Internbot (optional path)
   Browser → Internbot api → advisor router → same POST as step 2
```

Without `SUPABASE_*` and `GEMINI_API_KEY` on the deployed function, chat still runs but **retrieval is empty** (prompt-only answers, no sources).

### Monorepo layout

| Path                          | Purpose                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `backend/`                    | Express on Cloud Functions — chat, knowledge, benchmarks, public `/api/v1` |
| `frontend/`                   | Demo dashboard — assistant UI, knowledge page, auth                        |
| `backend/supabase/schema.sql` | pgvector tables + `match_knowledge_chunks` RPC                             |
| `backend/data/`               | Bundled FAQ text, knowledge manifest, scraped RMIT pages                   |
| `backend/scripts/`            | `ingest:knowledge`, `keys:issue`, `scrape:rmit-pages`, OpenAPI emit        |
| `firebase/`                   | Firestore rules (API keys metadata), Storage rules                         |
| `docs/`                       | RAG-MVP, setup playbook, PUBLIC_API, HANDOVER                              |
| `scripts/`                    | Bootstrap, emulator test account, `grant-admin`                            |

### Backend architecture

Lighter than Internbot’s full CQRS stack, but same idea: **ports + infrastructure adapters**.

| Area                   | Key files                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| **Chat orchestration** | `application/chat/ChatService.ts`                                                         |
| **Retrieval**          | `infrastructure/retrieval/supabaseKnowledgeRetriever.ts`                                  |
| **Ingestion**          | `application/knowledge/ingestKnowledgeDocument.ts`, `chunkText.ts`, `parseFaqSections.ts` |
| **Gemini**             | `infrastructure/ai/geminiProvider.ts`, `geminiEmbeddingProvider.ts`                       |
| **HTTP**               | `api/app.ts` mounts routers                                                               |
| **Legacy chat**        | `api/routes/chat.ts` — `POST /api/chat/message` (Internbot uses this)                     |
| **Public v1**          | `api/routes/v1/chat.ts` — API key auth (`ibk_*`), server-to-server                        |
| **Knowledge admin**    | `api/routes/knowledge.ts` — requires Firebase `admin: true` claim                         |
| **API keys**           | `application/apiKeys/`, Firestore `api_keys` collection (hashed)                          |

#### Two HTTP auth models

| Surface                                  | Auth                                       | Used by                                              |
| ---------------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| `/api/chat/*`, `/api/knowledge/*` (most) | Firebase ID token (`authMiddleware`)       | Demo frontend via `/api/backend` proxy               |
| `/api/v1/*` (protected)                  | `Authorization: Bearer ibk_<env>_<secret>` | External integrators; optional future Internbot path |

See [docs/PUBLIC_API.md](docs/PUBLIC_API.md).

### Frontend (`frontend/`)

Next.js app for **operators and developers**, not capstone end users in production.

| Route                        | Purpose                                              |
| ---------------------------- | ---------------------------------------------------- |
| `/assistant?feature=faq-rag` | Chat UI (`components/demo/ChatInterface.tsx`)        |
| `/knowledge`                 | List/ingest documents (admin claim required for API) |
| `(auth)/login`, `register`   | Firebase Auth for demo                               |
| `(dashboard)/dashboard`      | Shell after login                                    |

**Proxy:** `src/app/api/backend/[...path]/route.ts` forwards to the Functions emulator or deployed API so the browser avoids CORS and can attach the Firebase token.

Unlike Internbot, this frontend may use **Server Routes** for the proxy (Internbot is static-only).

### Knowledge content

| Asset                    | Location                                               |
| ------------------------ | ------------------------------------------------------ |
| Student FAQ (cleaned)    | `backend/data/faq-internship-students-cleaned.txt`     |
| Ingest manifest          | `backend/data/knowledge-manifest.json`                 |
| Coordinator contacts     | `backend/data/coordinators-rmit-se-wil.txt`            |
| Scraped pages (optional) | `backend/data/scraped/*.txt` after `scrape:rmit-pages` |

Ingest everything:

```bash
pnpm --filter backend ingest:knowledge -- --replace-feature faq-rag
```

Details: [docs/RAG-SETUP-PLAYBOOK.md](docs/RAG-SETUP-PLAYBOOK.md) · [docs/RAG-MVP.md](docs/RAG-MVP.md).

### Tests and benchmarks

| Command                             | What it does                                                  |
| ----------------------------------- | ------------------------------------------------------------- |
| `pnpm run test`                     | Vitest unit tests (routes, chat service, parsers)             |
| `pnpm --filter backend benchmark:…` | Offline Gemini benchmark datasets under `backend/benchmarks/` |

### Suggested reading order

1. [docs/RAG-MVP.md](docs/RAG-MVP.md) — what is implemented
2. Run `pnpm run bootstrap` + `pnpm run dev`
3. `ingest:knowledge` with Supabase + Gemini configured
4. Open `/assistant?feature=faq-rag` and confirm **sources** in the reply
5. [docs/PUBLIC_API.md](docs/PUBLIC_API.md) — v1 contract for server clients
6. [docs/HANDOVER.md](docs/HANDOVER.md) — deploy on your Firebase account
7. Wire URL into Internbot `RAG_SERVICE_URL`

### Common tasks

| Task                 | Where                                                  |
| -------------------- | ------------------------------------------------------ |
| Update FAQ copy      | Edit `backend/data/`, re-run `ingest:knowledge`        |
| Change prompts       | `application/prompts/registry.ts`                      |
| Add public API field | `api/schemas/chat.ts`, v1 route, OpenAPI registry      |
| Issue integrator key | `pnpm --filter backend keys:issue`                     |
| Debug retrieval      | Supabase table `knowledge_chunks`, logs from retriever |

---

## Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| API          | Firebase Cloud Functions v2 · Express · TypeScript |
| Vectors      | Supabase Postgres · pgvector                       |
| LLM          | Google Gemini (chat + embeddings)                  |
| App metadata | Firestore (API key hashes)                         |
| Demo UI      | Next.js 16 · React 19 · Tailwind v4                |
| CI deploy    | GitHub Actions + service account secrets           |

---

## Quick start

**Prerequisites:** Node.js 22+, pnpm 10+, Docker, Supabase project, Gemini API key.

```bash
git clone https://github.com/giatinhuynh/interbotRAG.git
cd interbotRAG
pnpm run bootstrap
```

1. Set `.firebaserc` → your Firebase project id.
2. Fill `frontend/.env.local` and `backend/.env` ([docs/ENV-VARS.md](docs/ENV-VARS.md)).
3. Apply [backend/supabase/schema.sql](backend/supabase/schema.sql).
4. `pnpm run dev` → [http://localhost:3000](http://localhost:3000).

```bash
pnpm run supabase:schema
pnpm --filter backend ingest:knowledge -- --replace-feature faq-rag
```

Live RAG requires `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `GEMINI_API_KEY` in backend env.

---

## Connect Internbot

1. Deploy interbotRAG; note base URL: `https://australia-southeast1-<project>.cloudfunctions.net/api`
2. In Internbot: `RAG_SERVICE_URL` in `backend/.env` and `rag_service_url` in `.github/workflows/deploy-*.yml`
3. Redeploy Internbot functions; smoke-test student advisor in the Internbot UI

---

## Commands

```bash
pnpm run bootstrap
pnpm run dev
pnpm run build
pnpm run test
pnpm run emulator:setup
pnpm run grant-admin      # Emulator: admin claim for knowledge API
pnpm run supabase:schema
pnpm --filter backend ingest:knowledge
pnpm --filter backend keys:issue -- --label "internbot-dev" --env test
```

---

## Documentation

| Topic                | Link                                                         |
| -------------------- | ------------------------------------------------------------ |
| **Deploy handover**  | [docs/HANDOVER.md](docs/HANDOVER.md)                         |
| RAG MVP scope        | [docs/RAG-MVP.md](docs/RAG-MVP.md)                           |
| Setup playbook       | [docs/RAG-SETUP-PLAYBOOK.md](docs/RAG-SETUP-PLAYBOOK.md)     |
| Public API v1        | [docs/PUBLIC_API.md](docs/PUBLIC_API.md)                     |
| Env vars             | [docs/ENV-VARS.md](docs/ENV-VARS.md)                         |
| Backend notes        | [docs/BACKEND.md](docs/BACKEND.md)                           |
| CI/CD                | [docs/CI-CD.md](docs/CI-CD.md)                               |
| Commands cheatsheet  | [docs/COMMANDS-CHEATSHEET.md](docs/COMMANDS-CHEATSHEET.md)   |
| Internbot (main app) | [Internbot README](https://github.com/giatinhuynh/Internbot) |

Agent rules: [CLAUDE.md](CLAUDE.md).

---

## Deployment

Step-by-step: **[docs/HANDOVER.md](docs/HANDOVER.md)**. CI deploys on push to **`main`** via `.github/workflows/deploy-firebase.yml` (GitHub Secrets, not OIDC).

Outgoing example API base: `https://australia-southeast1-internbotrag.cloudfunctions.net/api`

---

## Troubleshooting

| Symptom                   | What to try                                         |
| ------------------------- | --------------------------------------------------- |
| No sources in replies     | Run ingest; check Supabase + Gemini env on function |
| Internbot advisor 503     | Internbot `RAG_SERVICE_URL` unset or wrong          |
| `.firebaserc` placeholder | Set real Firebase project id                        |
| Knowledge API 403         | Firebase user needs `{ admin: true }` claim         |

More: [docs/HANDOVER.md § Troubleshooting](docs/HANDOVER.md#troubleshooting).

---

## License

RMIT Capstone — interbotRAG component of the Internbot project.
