# Build and start Firebase emulators (Docker). Run from repo root: .\scripts\setup-local-emulators.ps1
# First-time full setup: prefer pnpm run bootstrap (deps + env templates + this step).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

docker info 2>&1 | Out-Null
if (-not $?) {
    Write-Host "Docker is not running. Start Docker Desktop and try again." -ForegroundColor Red
    exit 1
}

Write-Host "Building firebase-emulators image..."
docker compose build firebase-emulators
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Starting firebase-emulators..."
docker compose up -d firebase-emulators
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Emulator UI: http://localhost:4000"
Write-Host "For local dev: USE_EMULATOR=true in backend/.env and NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true in frontend/.env.local, then: pnpm run dev"
