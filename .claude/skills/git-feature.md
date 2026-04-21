---
description: Create a Gitflow feature branch from develop and open a draft PR. Branch and PR reference a Jira ticket key (IC-XX). Use when starting new work.
argument-hint: "[IC-XX feature-name]"
---

# Skill: /git-feature

Create a Gitflow feature branch + open a draft PR targeting `develop`, linked to a Jira ticket in project `IC` (Internbot-Capstone).

## Step 0 — Find or create the Jira ticket

Before branching, every feature needs a Jira ticket so commits, branch, and PR auto-link to it.

1. If the user supplies a ticket key (e.g. `IC-57`), use it.
2. If not, ask the user. Offer two paths:
   - **Existing ticket**: search `IC` using `mcp__plugin_atlassian_atlassian__searchJiraIssuesUsingJql` with a JQL like `project = IC AND text ~ "<keyword>"`.
   - **New ticket**: create with `mcp__plugin_atlassian_atlassian__createJiraIssue` — confirm `summary`, `issueTypeName` (`Story` for most features, `Task` for tooling/infra, `Bug` for fixes), and `parent` Epic if applicable.

The rest of the skill assumes `IC-XX` is the ticket key.

## Step 1 — Gather requirements

Ask the user:

1. **Short kebab-case slug** for the branch name (e.g., `invoice-pdf-export`, `phase-1-identity`)
2. **One-sentence summary** for the PR description

## Step 2 — Execute

```bash
# Ensure we're up to date
git fetch origin
git checkout develop
git pull origin develop

# Create the feature branch with the ticket key embedded
git checkout -b feature/IC-XX-{slug}

# Push
git push -u origin feature/IC-XX-{slug}

# Open draft PR with ticket key in the title + a trailer-style link in the body
gh pr create \
  --title "[IC-XX] feat: {summary}" \
  --body "$(cat <<'EOF'
## Summary
- {one-sentence-summary}

## Jira
- Refs IC-XX

## Test plan
- [ ] Unit tests pass
- [ ] Manual smoke test on emulators
EOF
)" \
  --base develop \
  --draft
```

## Conventions

- **Branch name**: `feature/IC-XX-{kebab-slug}` — ticket key first so branch listings sort by ticket, always branched from `develop`
- **PR title**: `[IC-XX] <type>: <summary>` — the `[IC-XX]` prefix is what Atlassian's GitHub integration uses to auto-link and auto-transition
- **PR body**: must contain `Refs IC-XX` (or `Closes IC-XX` when merging fully resolves the ticket) on its own line
- **Commit messages**: follow Conventional Commits; include `IC-XX` as the last line of the body (trailer) so every commit links:

  ```
  feat(auth): implement POST /auth/sync

  IC-XX
  ```

- Start as a draft until ready for review

## After the PR is merged

The branch is deleted automatically. Atlassian's GitHub app transitions the ticket if the PR body uses `Closes IC-XX`.
