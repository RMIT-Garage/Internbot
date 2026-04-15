---
description: Create a Gitflow hotfix branch from main for urgent production fixes. Use when a production bug needs an immediate fix.
argument-hint: "[hotfix-name]"
---

# Skill: /git-hotfix

Create a Gitflow hotfix branch from `main` for urgent production fixes.

## Step 1 — Gather requirements

Ask the user:

1. **Issue/bug** — brief description of what's broken in production
2. **Hotfix name** — short kebab-case (e.g., `auth-token-expiry`, `null-ref-crash`)
3. **Next patch version** — what will the version bump be? (e.g., `1.0.1`)

## Step 2 — Execute

```bash
# Ensure we're on a clean, up-to-date main
git fetch origin
git checkout main
git pull origin main

# Create hotfix branch from main
git checkout -b hotfix/{hotfix-name}

# Push immediately
git push -u origin hotfix/{hotfix-name}

# Open PR targeting main
gh pr create \
  --title "fix: {hotfix-name}" \
  --body "## Problem\n{describe the production bug}\n\n## Fix\n{describe the fix}\n\n## Test plan\n- [ ] Regression test added\n- [ ] Tested on emulators\n\n⚠️ Hotfix — targets main directly\n\n🤖 Generated with Claude Code" \
  --base main
```

## After merging to main

Once the hotfix PR is merged to `main`:

1. Tag the release: `git tag v{version} && git push origin v{version}`
2. Open a **back-merge PR** from `main` → `develop` to keep them in sync:
   ```bash
   gh pr create --title "chore: back-merge hotfix/{hotfix-name} to develop" \
     --base develop --head main
   ```

## Important

- Hotfixes go to `main` directly — they bypass `develop`
- Always back-merge to `develop` after merging to `main`
- Keep the fix minimal — only the critical change, no opportunistic cleanup
