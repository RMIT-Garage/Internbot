# Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                  Browser                                     │
│  Next.js 16 (React 19)                                                       │
│  ├── Firebase Auth                                                           │
│  ├── Dashboard pages (`/demo`, `/knowledge`)                                │
│  └── Same-origin proxy (`/api/backend/*`)                                   │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ HTTPS
                                ▼
                   ┌──────────────────────────────────┐
                   │     Firebase App Hosting         │
                   │     (frontend Next.js app)       │
                   └────────────────┬─────────────────┘
                                    │ server-side proxy
                                    ▼
                   ┌──────────────────────────────────┐
                   │  Cloud Functions v2 + Express    │
                   │  `/api/chat/*` `/api/knowledge/*`│
                   └───────┬───────────────┬──────────┘
                           │               │
               Firebase Admin SDK          │ Gemini API
                           │               ├── generate text
                           │               └── generate embeddings
                           ▼
                 ┌──────────────────┐      ▼
                 │     Firebase      │   ┌─────────────────────────────┐
                 │  ├── Auth         │   │     Supabase Postgres       │
                 │  ├── Firestore    │   │  ├── knowledge_documents    │
                 │  └── Storage      │   │  ├── knowledge_chunks       │
                 └──────────────────┘   │  └── match_knowledge_chunks │
                                        └─────────────────────────────┘
```

## Request Patterns

### Server-Rendered Page (Server Component)

1. Browser requests `/dashboard`
2. Next.js middleware checks `__session` cookie → authenticated
3. Server Component renders, fetching Firestore data via Firebase Admin SDK
4. HTML streamed to browser

### Client-Side Real-time Data

1. Client Component mounts
2. `useCollection()` hook subscribes to Firestore via `onSnapshot`
3. UI updates live as Firestore data changes

### API Call (Cloud Functions)

1. Client obtains Firebase ID token: `user.getIdToken()`
2. Client sends `Authorization: Bearer {token}` to `/api/backend/...`
3. The Next.js proxy route forwards headers/body to the backend Cloud Function
4. `authMiddleware` verifies the token via Firebase Admin SDK
5. Route handler executes the use case and returns JSON

### Knowledge Ingestion Flow

1. Admin visits `/knowledge`
2. Frontend submits `feature`, `title`, `section`, `content`, and optional `sourceUrl`
3. `POST /api/knowledge/documents` checks `actor.claims.admin === true`
4. `IngestKnowledgeDocument` chunks the text using `application/knowledge/chunkText.ts`
5. `GeminiEmbeddingProvider` generates embeddings per chunk
6. `SupabaseKnowledgeRepository` inserts one row into `knowledge_documents` and many rows into `knowledge_chunks`
7. The frontend refreshes the document list

### Retrieval-Backed Chat Flow

1. User opens `/demo?feature=faq-rag` and submits a question
2. `POST /api/chat/message` validates `{ feature, userInput, fileContext? }`
3. `SupabaseKnowledgeRetriever` embeds the query with Gemini
4. The retriever calls Supabase RPC `match_knowledge_chunks`
5. `ChatService` appends retrieved chunks to the model input under `[RETRIEVED KNOWLEDGE]`
6. `GeminiModelProvider` generates the answer
7. Backend returns `{ reply, sources }`
8. `ChatInterface` renders the answer and source list

### Authentication Flow

1. User submits credentials → Firebase Auth signs in (client-side)
2. `onAuthStateChanged` fires → `AuthProvider` gets user
3. Client includes the Firebase ID token on backend API calls
4. `authMiddleware` verifies the token and injects `(req as AuthenticatedRequest).actor`
5. Knowledge management routes additionally require `actor.claims.admin === true`

## Security Model

- **Firestore rules** — last line of defence; always assume clients are untrusted
- **Cloud Functions** — verify ID tokens in `authMiddleware` for every protected route
- **Next.js Server Actions** — call `requireAuth()` (verifies session cookie via Admin SDK) before any data operation
- **Middleware** — optimistic cookie check only; never relies on this for security, only for redirects

## RAG Subsystem Responsibilities

### API layer

- `backend/src/api/routes/chat.ts`
  - validates chat payloads and returns `{ reply, sources }`
- `backend/src/api/routes/knowledge.ts`
  - exposes admin-only knowledge ingestion and listing routes
- `frontend/src/app/api/backend/[...path]/route.ts`
  - proxies frontend requests to the backend to avoid emulator CORS issues

### Application layer

- `backend/src/application/chat/ChatService.ts`
  - orchestrates retrieval-backed generation using application ports only
- `backend/src/application/knowledge/chunkText.ts`
  - performs deterministic overlapping chunking
- `backend/src/application/knowledge/ingestKnowledgeDocument.ts`
  - coordinates document creation, embeddings, and chunk persistence

### Infrastructure layer

- `backend/src/infrastructure/ai/geminiProvider.ts`
  - text generation
- `backend/src/infrastructure/ai/geminiEmbeddingProvider.ts`
  - embedding generation
- `backend/src/infrastructure/retrieval/supabaseKnowledgeRepository.ts`
  - writes and lists knowledge documents/chunks
- `backend/src/infrastructure/retrieval/supabaseKnowledgeRetriever.ts`
  - query embedding + Supabase RPC retrieval
- `backend/supabase/schema.sql`
  - source of truth for tables, vector index, and retrieval RPC

## Supabase knowledge schema

The RAG MVP uses two tables and one RPC function defined in `backend/supabase/schema.sql`:

- `knowledge_documents`
  - stores the canonical ingested entry
  - key fields: `feature`, `title`, `section`, `content`, `status`, `source_url`, `created_at`
- `knowledge_chunks`
  - stores retrieval units
  - key fields: `document_id`, `feature`, `title`, `section`, `text`, `chunk_index`, `embedding`, `source_url`
- `match_knowledge_chunks(query_embedding, filter_feature, match_count)`
  - returns the top matching chunks for a feature using cosine similarity

This SQL must be applied to the Supabase project before live ingestion/retrieval works.

## Key Design Decisions

**Why session cookies instead of just Firebase client auth?**
Next.js middleware runs on the Edge runtime and cannot use the Firebase Admin SDK (too heavy). The session cookie gives a lightweight signal to middleware for redirects. Cryptographic trust is established server-side near the data.

**Why feature-based folder structure?**
Features in `src/features/{feature}/` are self-contained — types, hooks, actions, and components together. Deleting a feature means deleting one folder. Cross-feature imports are explicit violations of the intended boundary.

**Why Express on Cloud Functions instead of individual functions?**
The "fat-lambda" pattern keeps local development identical to production (just run Express locally), simplifies testing with supertest, and avoids cold start multiplied across many functions.
