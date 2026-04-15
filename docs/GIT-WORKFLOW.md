# Git Workflow

This project uses **Gitflow**. All branch management is automated via Claude Code skills.

## Branch Structure

```
main         ← production (protected, deploys automatically)
  ↑
develop      ← integration (protected, CI runs on every push)
  ↑
feature/*    ← new features (branched from develop)
release/*    ← release prep (branched from develop)
hotfix/*     ← urgent production fixes (branched from main)
```

## Branch Naming

| Type    | Pattern                | Example                      |
| ------- | ---------------------- | ---------------------------- |
| Feature | `feature/{kebab-case}` | `feature/invoice-pdf-export` |
| Hotfix  | `hotfix/{kebab-case}`  | `hotfix/auth-token-expiry`   |
| Release | `release/{semver}`     | `release/1.3.0`              |

## Workflow

### New feature

```
/git-feature → creates feature/* → PR to develop → merge → delete branch
```

### Production fix

```
/git-hotfix → creates hotfix/* from main → PR to main → merge → back-merge to develop → tag
```

### Release

```
/git-release → creates release/* → version bump → PR to main → merge → tag → back-merge to develop
```

## Commit Messages (Conventional Commits)

The `commit-msg` hook enforces this format:

```
type(scope): description

Examples:
feat: add invoice PDF export
fix(auth): handle token expiry on refresh
docs: update Firestore schema for invoices
refactor(backend): extract auth middleware
test: add integration tests for health route
chore: upgrade firebase-admin to v13
```

**Types:** `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `build` · `ci` · `perf` · `revert`

## Merge Strategy

| Direction                       | Strategy     | Why                             |
| ------------------------------- | ------------ | ------------------------------- |
| `feature/*` → `develop`         | Squash merge | Clean linear history on develop |
| `release/*` → `main`            | Merge commit | Preserve release history        |
| `hotfix/*` → `main`             | Merge commit | Preserve fix history            |
| `main` → `develop` (back-merge) | Merge commit | Bring hotfix back to develop    |

## Release Rule

Only **one** `release/*` branch may exist at a time. Complete or abandon the current release before starting another — concurrent releases deploy to the same staging environment and would overwrite each other.

If a production fix is needed while a release is in staging, use `hotfix/*` instead (branches from `main`, bypasses staging).

## Protected Branches

`main` and `develop` are protected — no direct pushes. All changes go through pull requests.

CI must pass before merge:

- Lint + typecheck
- Unit tests
- Secret scan (gitleaks)
