# Git Workflow

This project uses **Gitflow**. Branch management can be automated via Claude Code skills (`/git-feature`, `/git-hotfix`, `/git-release`).

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

| Type    | Pattern                | Example                    |
| ------- | ---------------------- | -------------------------- |
| Feature | `feature/{kebab-case}` | `feature/phase-1-identity` |
| Hotfix  | `hotfix/{kebab-case}`  | `hotfix/auth-token-expiry` |
| Release | `release/{semver}`     | `release/1.3.0`            |

Release branches are versioned, not feature-scoped.

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

The `commit-msg` hook enforces [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

<body — optional paragraph>
```

Examples:

```
feat(auth): implement POST /auth/sync
```

```
fix(auth): handle token expiry on refresh
```

**Types:** `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `build` · `ci` · `perf` · `revert`

## Pull Requests

PR title format:

```
<type>: <summary>
```

Or with scope:

```
feat(semesters): add transition endpoint
```

PR body template:

```markdown
## Summary

- …

## Test plan

- [ ] …
```

## Overlapping work

### One PR touches multiple areas

- Use a clear **Summary** listing what changed.
- Split unrelated changes into separate PRs when possible.

### One feature needs multiple PRs

- **Preferred:** scaffold PR first, then routes, then tests — each PR small and reviewable.
- Mark early PRs as **Draft** until dependencies merge.

### Interdependent PRs

- Do not merge a PR that depends on unmerged work unless it can stub or mock the dependency.
- Call out blockers in the PR description (`Depends on #123`).
- Rebase onto latest `develop` after the blocker merges.

### Two in-flight PRs touch the same code

- Whoever merges first wins; the other PR rebases and resolves conflicts.
- Extract shared changes into a small prep PR if both need the same edit.
- Never push directly to `develop` or `main` — use PRs.

## Merge Strategy

| Direction                       | Strategy               | Why                                          |
| ------------------------------- | ---------------------- | -------------------------------------------- |
| `feature/*` → `develop`         | Squash merge           | Clean linear history on develop              |
| `develop` → `main`              | Merge commit `--no-ff` | Preserve release marker; ancestry intact     |
| `release/*` → `main`            | Merge commit `--no-ff` | Preserve release history                     |
| `hotfix/*` → `main`             | Merge commit `--no-ff` | Preserve fix history                         |
| `hotfix/*` → `develop`          | Merge commit `--no-ff` | Don't squash — back-merges need it visible   |
| `main` → `develop` (back-merge) | Merge commit `--no-ff` | Bring release/hotfix into develop's ancestry |

## Back-Merge Rule (after hotfixes only)

After a `hotfix/*` → `main` lands, manually merge `main` back into `develop` so develop has the fix:

```bash
git checkout develop
git pull
git merge main --no-ff -m "chore(merge): back-merge main → develop after hotfix"
git push origin develop
```

This is **only needed when something edits main outside of a develop → main release** — typically hotfixes. For pure `develop → main` releases the back-merge is unnecessary because develop's tip is already a parent of main's merge commit (that's what `--no-ff` preserves).

## Release Cadence

Promote `develop` → `main` on a **regular cadence**, not on accumulation. Pick one and stick with it:

- **Phase-based**: every completed phase in `WORKFLOW-API-IMPLEMENTATION-PLAN.md` → release.
- **Time-based**: every week → release whatever is on develop.
- **Count-based**: every 5–10 squash-merges on develop → release.

Solo-dev GitFlow only works when releases are _frequent and small_. Letting develop accumulate 30+ commits before a release produces large merge conflicts and stale Dependabot configs.

## Dependabot

Dependabot reads `.github/dependabot.yml` from `main` only — that's a GitHub constraint, not a project decision. With `target-branch: develop` set in the config, version-update PRs are opened against `develop` (so they integrate with feature work and ride to main on the next release). Security-update PRs always target the default branch (`main`) and ignore `target-branch`.

**Merging Dependabot PRs** — same rules as the merge strategy table:

- **Version updates** (→ `develop`) — squash, like any feature PR.
- **Security updates** (→ `main`) — treat as a hotfix: merge with `--no-ff`, then back-merge `main → develop`. Don't squash; that strips ancestry and re-creates the merge-base problem the strategy table exists to prevent.

Edit `.github/dependabot.yml` on `develop` like any other file. The new config activates when the next `develop` → `main` release lands. The cadence rule above keeps that lag short — letting it sit for 30+ commits is what produced the stale-config / wrong-target-branch problem on an earlier release.

If a different file ever needs to be read from `main` only (`CODEOWNERS`, CodeQL default config, etc.), the same lag applies and the same cadence rule fixes it. Don't bypass cadence by branching from main for one-off config edits — that creates a divergent main that develop never gets, defeating the whole pattern.

## Release Rule

Only **one** `release/*` branch may exist at a time. Complete or abandon the current release before starting another — concurrent releases deploy to the same staging environment and would overwrite each other.

If a production fix is needed while a release is in staging, use `hotfix/*` instead (branches from `main`, bypasses staging).

## Protected Branches

`main` and `develop` are protected — no direct pushes. All changes go through pull requests.

CI must pass before merge:

- Lint + typecheck
- Unit tests
- Secret scan (gitleaks)
