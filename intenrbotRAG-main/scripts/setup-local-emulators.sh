#!/usr/bin/env bash
# Build and start Firebase emulators (Docker). Run from repo root: ./scripts/setup-local-emulators.sh
# First-time full setup: prefer `pnpm run bootstrap` (installs deps + env templates + this step).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop (or the Docker daemon) and try again."
  exit 1
fi

echo "Building firebase-emulators image..."
docker compose build firebase-emulators

echo "Starting firebase-emulators..."
docker compose up -d firebase-emulators

echo ""
echo "Emulator UI: http://localhost:4000"
echo "For local dev against emulators, set in backend/.env: USE_EMULATOR=true"
echo "and in frontend/.env.local: NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true"
echo "Then: pnpm run dev"
