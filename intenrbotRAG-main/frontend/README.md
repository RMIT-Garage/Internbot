# interbotRAG — Frontend

Next.js App Router UI for the interbotRAG service: landing, auth, dashboard, **assistant** demo (`/assistant?feature=faq-rag`), and **knowledge** ingest (`/knowledge`, admin).

Production **Internbot** users use the separate [Internbot](https://github.com/giatinhuynh/Internbot) app; this frontend is for operators and local testing.

## Author

| Name              | Student ID |
| ----------------- | ---------- |
| Duc Gia Tin Huynh | s3962053   |

## Run locally

From the **repository root** (starts emulators):

```bash
pnpm run dev
```

Frontend only:

```bash
pnpm --filter frontend dev
```

Open [http://localhost:3000](http://localhost:3000). Copy `frontend/.env.example` → `frontend/.env.local` first — see root [README](../README.md).

API calls go through `src/app/api/backend/[...path]/route.ts` (proxies to the Functions emulator or deployed backend).

## Key folders

- `src/app` — route groups `(auth)`, `(dashboard)`
- `src/components/demo` — chat UI (`ChatInterface`, sources)
- `src/providers` — auth
- `public` — branding assets

## Docs

| Topic         | Link                                     |
| ------------- | ---------------------------------------- |
| Root setup    | [../README.md](../README.md)             |
| Design system | [../docs/DESIGN.md](../docs/DESIGN.md)   |
| RAG MVP       | [../docs/RAG-MVP.md](../docs/RAG-MVP.md) |
