---
description: Create a Gitflow feature branch from develop and open a draft PR. Use when starting new work.
argument-hint: "[feature-name]"
---

# Skill: /git-feature

Create a Gitflow feature branch and open a draft PR targeting `develop`.

## Step 1 — Gather requirements

Ask the user:

1. **Feature name** — short kebab-case description (e.g., `invoice-pdf-export`, `team-invitations`)
2. **Brief description** — one sentence for the PR description

## Step 2 — Execute

```bash
# Ensure we're up to date
git fetch origin
git checkout develop
git pull origin develop

# Create the feature branch
git checkout -b feature/{feature-name}

# Push and open draft PR
git push -u origin feature/{feature-name}
gh pr create \
  --title "feat: {feature-name}" \
  --body "## Summary\n- {brief-description}\n\n## Test plan\n- [ ] Unit tests pass\n- [ ] Manual smoke test on emulators\n\n🤖 Generated with Claude Code" \
  --base develop \
  --draft
```

## Conventions

- Branch name: `feature/{kebab-case-name}` — always branched from `develop`
- PR targets `develop` (not `main`)
- Start as a draft until it's ready for review
- Commit messages must follow Conventional Commits (enforced by commit-msg hook):
  - `feat:` new feature
  - `fix:` bug fix
  - `docs:` documentation
  - `refactor:` code restructure without behaviour change
  - `test:` adding tests
  - `chore:` tooling, deps, config

## After the PR is merged

The branch is deleted automatically by GitHub. Do not manually delete `develop`.
