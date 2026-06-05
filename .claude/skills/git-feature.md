---
description: Create a Gitflow feature branch from develop and open a draft PR. Use when starting new work.
argument-hint: "[feature-name]"
---

# Skill: /git-feature

Create a Gitflow feature branch + open a draft PR targeting `develop`.

## Step 1 — Gather requirements

Ask the user:

1. **Short kebab-case slug** for the branch name (e.g., `invoice-pdf-export`, `phase-1-identity`)
2. **One-sentence summary** for the PR description
3. **Conventional Commits type** for the PR title (`feat`, `fix`, `docs`, etc.)

## Step 2 — Execute

```bash
# Ensure we're up to date
git fetch origin
git checkout develop
git pull origin develop

# Create the feature branch
git checkout -b feature/{slug}

# Push
git push -u origin feature/{slug}

# Open draft PR
gh pr create \
  --title "{type}: {summary}" \
  --body "$(cat <<'EOF'
## Summary
- {one-sentence-summary}

## Test plan
- [ ] Unit tests pass
- [ ] Manual smoke test on emulators
EOF
)" \
  --base develop \
  --draft
```

## Conventions

- **Branch name**: `feature/{kebab-slug}` — always branched from `develop`
- **PR title**: `<type>: <summary>` per [docs/GIT-WORKFLOW.md](../../docs/GIT-WORKFLOW.md)
- **Commit messages**: Conventional Commits (`feat(scope): description`)
- Start as a draft until ready for review

## After the PR is merged

The branch is deleted automatically (if the repo has branch cleanup enabled).
