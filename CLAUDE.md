# CLAUDE.md — Internbot

This file is a repo-wide index and rule sheet. Read it first, then open the matching source doc for the task.

## Project

Internbot is an internship platform for RMIT students and coordinators. The full workflow, API contract, status model, and Firestore domain rules live in [docs/WORKFLOW-API-SPEC.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-SPEC.md).

## Index

Use these files as the source of truth by concern:

- Workflow, API contract, statuses, and Firestore model:
  [docs/WORKFLOW-API-SPEC.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-SPEC.md)
- System architecture:
  [docs/ARCHITECTURE.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/ARCHITECTURE.md)
- Firestore schema summary:
  [docs/FIRESTORE-SCHEMA.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/FIRESTORE-SCHEMA.md)
- Frontend conventions:
  [docs/FRONTEND.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/FRONTEND.md)
- Backend conventions:
  [docs/BACKEND.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/BACKEND.md)
- Security expectations:
  [docs/SECURITY.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/SECURITY.md)
- Testing expectations:
  [docs/TESTING.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/TESTING.md)
- Environment variables:
  [docs/ENV-VARS.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/ENV-VARS.md)
- Infrastructure and Terraform:
  [docs/INFRASTRUCTURE.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/INFRASTRUCTURE.md)
- CI/CD:
  [docs/CI-CD.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/CI-CD.md)
- Git workflow:
  [docs/GIT-WORKFLOW.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/GIT-WORKFLOW.md)
- UI and design direction:
  [docs/DESIGN.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/DESIGN.md)
- Frontend package guidance:
  [frontend/CLAUDE.md](/Users/nhatdongdang/Documents/Code/Internbot/frontend/CLAUDE.md)
- Backend package guidance:
  [backend/CLAUDE.md](/Users/nhatdongdang/Documents/Code/Internbot/backend/CLAUDE.md)

## Repo Map

```text
/ 
├── frontend/        Next.js app
├── backend/         Cloud Functions v2 API
├── e2e/             Playwright browser tests
├── docker/          Emulator Docker and Firebase CLI config
├── docs/            Product and engineering docs
├── infrastructure/  Terraform
└── scripts/         Utility scripts
```

## Repo-Wide Rules

- Use `pnpm`, not `npm` or `yarn`.
- Treat [docs/WORKFLOW-API-SPEC.md](/Users/nhatdongdang/Documents/Code/Internbot/docs/WORKFLOW-API-SPEC.md) as the domain source of truth.
- Use the platform `users/{id}` as the app identity. Do not use `firebaseUid` as a foreign key or route id.
- When a change affects documented behavior, update the relevant docs in the same session.
- Do not let root `CLAUDE.md`, package `CLAUDE.md` files, and docs drift from the codebase.
