# Commands Cheat Sheet

Quick commands for local setup and daily development.

## First-time setup

```bash
# 1) Install dependencies
pnpm install

# 2) Start Firebase emulators in Docker (first build)
pnpm run emulator:setup

# 3) Start app (frontend + emulators)
pnpm run dev
```

## One-time after env is configured

```bash
# Apply Supabase schema for RAG tables/functions
pnpm run supabase:schema

# Create/register a user in the app first, then grant admin in Auth emulator
pnpm run grant-admin

# Create/update reusable test account (admin=true)
# (auto-runs on `pnpm run emulator` / `pnpm run emulator:setup`)
pnpm run seed:test-account

# Ingest contract sample into knowledge base
pnpm --filter backend run ingest:contract-sample

# Ingest FAQ PDF sample into knowledge base
pnpm --filter backend run ingest:faq-students-sample
```

## Daily workflow

```bash
# Start frontend + emulators
pnpm run dev
```

Reusable test login (emulator):

- Email: `test@interbotrag.local`
- Password: `Test1234!`

If emulators are already running and you only want to restart them:

```bash
pnpm run emulator
```

## When env or backend code changes

```bash
# If backend/.env changed: recreate container (restart is not enough)
docker compose up -d --force-recreate firebase-emulators

# If backend function code changed: rebuild emulator image
pnpm run emulator:setup
```

## Useful checks

```bash
# Full tests
pnpm run test:all

# Checker smoke benchmarks (fixture mode)
pnpm --filter backend run benchmark -- --mode=smoke --feature=contract-checker
pnpm --filter backend run benchmark -- --mode=smoke --feature=job-checker

# Health endpoint through Next proxy
# http://localhost:3000/api/backend/health
```

## Stop services

```bash
pnpm run emulator:down
```
