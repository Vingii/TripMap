---
description: Pick a YouTrack task and implement it end-to-end: branch → implement → commit → push → PR
argument-hint: [task-id]
---

# dev — YouTrack task workflow

## Step 1: Identify the task

**If `$ARGUMENTS` is provided** (e.g. `/dev TM-14`):
- Fetch the issue with `mcp__youtrack__get_issue` using the given ID.

**If no argument was given**:
- Search for pending TM issues using `mcp__youtrack__search_issues` with query `project: TM State: Open, Wishlist order by: created asc`.
- Present the list to the user with `AskUserQuestion` and let them pick one.

## Step 2: Review and clarify

- Display the task summary and full description to the user.
- If the description is missing details that would meaningfully block implementation, ask now before touching any code.
- If everything is clear, confirm with the user and proceed.

## Step 3: Create and checkout the branch

- Derive a slug from the task summary: lowercase, replace spaces/special characters with hyphens, truncate to ~40 characters.
- Branch name format: `{TASK-ID}-{slug}` — e.g. `TM-14-location-crud`
- Run: `git checkout -b {branch-name}`

## Step 4: Mark the task In Progress

- Update the YouTrack issue: `mcp__youtrack__update_issue` with `{"State": "In Progress"}`.

## Step 5: Implement

- Explore the codebase to understand relevant context before writing any code.
- Implement according to the acceptance criteria in the YouTrack issue.
- Ask clarifying questions along the way if you hit ambiguity that would meaningfully change the implementation — but keep interruptions minimal.
- Run existing tests if available; fix any breakage before moving on.

## Step 6: Commit

- Stage specific files by name — do not use `git add -A`.
- Commit message format:
  ```
  {TASK-ID}: {short imperative summary}

  {optional body if the change needs context beyond the title}
  ```

## Step 7: Push

- `git push -u origin {branch-name}`

## Step 8: Open a PR

Use `gh pr create` targeting `main`. Pass the body via heredoc to preserve formatting.

PRs are squash-merged with GitHub configured to use the PR title and description as the commit message. **The PR title and body become the final commit on `main`** — so both must be shaped as a Conventional Commit, not as a review document.

### PR title

`{type}: {short summary} ({TASK-ID})` — Conventional Commits with the YouTrack ID in parentheses at the end:

- `feat:` — new user-facing capability (minor bump)
- `fix:` — bug fix (patch bump)
- `chore|docs|refactor|test|ci:` — no version bump
- `feat!:` (or any `<type>!:`) or a `BREAKING CHANGE:` footer in the body → major bump

Pick the type from the YouTrack issue's nature (Feature → `feat`, Bug → `fix`), not from how the change happens to be implemented.

### PR body — Conventional Commit body + footers

Plain prose, no markdown headings. 1–2 short paragraphs explaining the **why** of the change (not the what — the diff covers that). Then a blank line, then footers. Keep the whole body under ~10 lines so the commit log stays readable.

```
{1–2 paragraphs explaining why this change exists — the constraint, decision, or trade-off behind it. No headings, no bullet lists.}

Refs: {TASK-ID}
```

Additional footers when applicable:
- `BREAKING CHANGE: {what breaks and the migration path}` — required for any breaking change
- `Co-Authored-By: …` — for co-authors

Do **not** put Summary/Test plan/Task description sections in the PR body — those are review aids and belong in PR comments (Step 9), not in git history.

Return the PR URL to the user once created.

## Step 9: Add review and context comments

After the PR is created, add two comments with `gh pr comment {pr-number} --body "$(cat <<'EOF' … EOF)"`. These are for the reviewer and for preserving task context on the GitHub side; they are not part of git history.

**Review aid comment:**
```
## Summary
{1–3 bullet points covering what was done and any notable decisions or trade-offs}

## Test plan
{Bulleted checklist of how to manually verify the change}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

**Task description comment:**
```
## Task description
{Full task description from YouTrack, reproduced verbatim}
```

## Step 10: Link the PR back to YouTrack

- Add a comment to the YouTrack issue with `mcp__youtrack__add_issue_comment`, body: `PR: {pr-url}`.
