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

PR title: `{TASK-ID}: {task summary}`

PR body structure:
```
## Summary
{1–3 bullet points covering what was done and any notable decisions or trade-offs}

## Test plan
{Bulleted checklist of how to manually verify the change}

## Task description
{Full task description from YouTrack, reproduced verbatim}

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Return the PR URL to the user once created.

## Step 9: Link the PR back to YouTrack

- Add a comment to the YouTrack issue with `mcp__youtrack__add_issue_comment`, body: `PR: {pr-url}`.
