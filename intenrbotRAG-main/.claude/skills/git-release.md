---
description: Create a Gitflow release branch from develop, bump versions, and open a PR to main. Use when preparing a new release.
argument-hint: "[version e.g. 1.2.0]"
---

# Skill: /git-release

Create a Gitflow release branch from `develop`, bump versions, and open a PR targeting `main`.

## Step 1 — Gather requirements

Ask the user:

1. **Version number** — what is the new version? (e.g., `1.2.0`) — follow semver
   - `major` = breaking change
   - `minor` = new feature, backwards-compatible
   - `patch` = bug fix
2. **Release notes** — key changes to include in the PR description

## Step 2 — Execute

```bash
# Ensure develop is up to date
git fetch origin
git checkout develop
git pull origin develop

# Create release branch
git checkout -b release/{version}

# Bump versions in all packages
pnpm --filter frontend exec npm version {version} --no-git-tag-version
pnpm --filter backend exec npm version {version} --no-git-tag-version
# Update root package.json version too
npm version {version} --no-git-tag-version

# Commit the version bump
git add package.json frontend/package.json backend/package.json pnpm-lock.yaml
git commit -m "chore: bump version to {version}"

# Push and open PR
git push -u origin release/{version}
gh pr create \
  --title "release: v{version}" \
  --body "## Release v{version}\n\n### Changes\n{release-notes}\n\n## Checklist\n- [ ] Version bumped in all packages\n- [ ] All tests pass\n- [ ] Staging deployment verified\n- [ ] Changelog updated\n\n🤖 Generated with Claude Code" \
  --base main
```

## After merging to main

1. Tag the release:

   ```bash
   git checkout main && git pull origin main
   git tag v{version} -m "Release v{version}"
   git push origin v{version}
   ```

2. Back-merge to develop:

   ```bash
   gh pr create --title "chore: back-merge release v{version} to develop" \
     --base develop --head main
   ```

3. The CI/CD pipeline deploys to production automatically on tag push (see `.github/workflows/deploy.yml`).
