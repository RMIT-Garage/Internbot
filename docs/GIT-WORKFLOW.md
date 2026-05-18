# Git Workflow

This project uses **Gitflow** + **Jira** (project `IC` — Internbot-Capstone). All branch management is automated via Claude Code skills.

Every feature, fix, or chore is tracked by a Jira ticket (`IC-*`). The ticket key appears in the branch name, commit trailer, and PR title so Atlassian's GitHub integration can auto-link and auto-transition.

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

| Type    | Pattern                      | Example                          |
| ------- | ---------------------------- | -------------------------------- |
| Feature | `feature/IC-XX-{kebab-case}` | `feature/IC-57-phase-1-identity` |
| Hotfix  | `hotfix/IC-XX-{kebab-case}`  | `hotfix/IC-91-auth-token-expiry` |
| Release | `release/{semver}`           | `release/1.3.0`                  |

Feature and hotfix branches always carry the Jira ticket key. Release branches are versioned, not ticket-scoped.

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

## Commit Messages (Conventional Commits + Jira)

The `commit-msg` hook enforces Conventional Commits. We additionally add a Jira trailer on the last line of the message body so every commit links to its ticket.

```
<type>(<scope>): <description>

<body — optional paragraph>

IC-XX
```

Examples:

```
feat(auth): implement POST /auth/sync

IC-57
```

```
fix(auth): handle token expiry on refresh

Closes IC-91
```

`IC-XX` alone adds a reference; `Closes IC-XX` both references and transitions the ticket to Done when the PR merges (Atlassian GitHub integration).

**Types:** `feat` · `fix` · `docs` · `style` · `refactor` · `test` · `chore` · `build` · `ci` · `perf` · `revert`

## Pull Requests

PR title format:

```
[IC-XX] <type>: <summary>
```

PR body must include a `Jira` section with `Refs IC-XX` (or `Closes IC-XX`):

```markdown
## Summary

- …

## Jira

- Refs IC-57

## Test plan

- [ ] …
```

The `[IC-XX]` prefix is what Atlassian's GitHub app reads for the auto-link in the Jira ticket's development panel.

## Overlapping tickets

Real work doesn't always map one PR to one ticket. Four common overlap cases and how we handle them:

### 1. One PR contributes to multiple tickets

Example: a backend phase PR that partially implements several frontend `US-*` stories.

- **PR title**: use the primary ticket as `[IC-XX]` (the one the PR is _most_ about — usually the backend phase Story itself).
- **PR body** — list all tickets in the `Jira` section:

  ```markdown
  ## Jira

  - Closes IC-57 # primary — this PR fully delivers this ticket
  - Refs IC-26, IC-27 # contributes partial work; these stay open
  ```

- **Commit message** — multiple trailers, one per line (Atlassian picks up all):

  ```
  feat(backend): implement Phase 1

  IC-57
  IC-26
  IC-27
  ```

### 2. One ticket needs multiple PRs

Example: a large story that takes a scaffold PR, a routes PR, and a tests PR.

- **Preferred**: break the ticket into sub-tasks in Jira first (one per PR). Each PR then references its sub-task (`IC-XX-1`, `IC-XX-2`, …) with `Closes`; the parent ticket auto-completes when all sub-tasks are done.
- **Alternative**: all PRs `Refs IC-XX`; the last one uses `Closes IC-XX`. Earlier PRs use `Refs` so the ticket doesn't transition to Done prematurely.

### 3. Interdependent tickets

Example: Phase 2 backend blocks Phase 2 frontend; or Phase 5 requires Phase 4 to be merged first.

- **Model the dependency in Jira**, not in the PR. Use issue links:
  - `is blocked by` — A can't start until B merges (frontend frequently blocked by backend)
  - `blocks` — reverse of above (set from the blocker side)
  - `relates to` — informational, no enforcement
- The PR body should call out the dependency in its `Jira` section:

  ```markdown
  ## Jira

  - Closes IC-58
  - Depends on IC-57 (merged)
  ```

- Do not open a PR for a ticket whose blockers are still `To Do` unless the work can stub / mock the missing piece. If you do, mark the PR as **Draft** until the blocker merges.

### 4. Two in-flight PRs touch overlapping code

Git-level, not Jira-level. Normal PR discipline:

- Whoever merges first wins. The later PR rebases onto the updated `develop` and resolves the conflict.
- If both PRs genuinely need the same edit, extract the shared change into its own tiny prep-PR first, merge it, then both downstream PRs rebase on it.
- Talk to the other author. Coordination beats merge-conflict resolution every time.
- Never "claim" a file by committing to `develop` out-of-band. Shared code lives behind PRs.

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
- **Time-based**: every Sunday → release whatever is on develop.
- **Count-based**: every 5–10 squash-merges on develop → release.

Solo-dev GitFlow only works when releases are _frequent and small_. Letting develop accumulate 30+ commits before a release is the failure mode that produces enormous merge conflicts and stale Dependabot configs.

## Dependabot

Dependabot reads `.github/dependabot.yml` from `main` only — that's a GitHub constraint, not a project decision. With `target-branch: develop` set in the config, version-update PRs are opened against `develop` (so they integrate with feature work and ride to main on the next release). Security-update PRs always target the default branch (`main`) and ignore `target-branch`.

**Merging Dependabot PRs** — same rules as the merge strategy table:

- **Version updates** (→ `develop`) — squash, like any feature PR.
- **Security updates** (→ `main`) — treat as a hotfix: merge with `--no-ff`, then back-merge `main → develop`. Don't squash; that strips ancestry and re-creates the merge-base problem the strategy table exists to prevent.

Edit `.github/dependabot.yml` on `develop` like any other file. The new config activates when the next `develop` → `main` release lands. The cadence rule above is what keeps that lag short — letting it sit for 30+ commits is what produced the stale-config / wrong-target-branch problem we hit at the IC-58 release.

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
