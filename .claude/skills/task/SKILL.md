---
description: Create a new YouTrack task in the TM project with a consistent description format
argument-hint: [summary]
---

# task — Create a YouTrack issue

## Step 1: Get the summary

**If `$ARGUMENTS` is provided**, use it as the task summary.

**If no argument was given**, ask the user what the task is about in one sentence.

## Step 2: Gather details through guided proposals

Based on the summary and any available context (open files, CLAUDE.md, codebase), **draft a proposed description and acceptance criteria yourself**, then present them to the user for confirmation or adjustment. Do not ask open-ended questions — propose something concrete.

Structure your proposal like this:

> **Description:** {your proposed 1–3 sentence description}
>
> **Acceptance criteria (proposed):**
> - {criterion}
> - …
>
> Does this look right? I can also add **Technical Notes** if there are implementation details to capture.

If the summary is ambiguous, offer 2–3 short interpretations and ask which fits best before drafting the full proposal.

Iterate based on user feedback until the criteria are clear and actionable.

## Step 3: Create the issue

Use `mcp__youtrack__create_issue` with:
- `project`: `TM`
- `summary`: the task summary from Step 1
- `description`: formatted as below
- `customFields`: `{"Type": "Feature", "Priority": "Normal"}`

## Description format

```
{Short description — 1–3 sentences}

## Acceptance Criteria
- {criterion}
- {criterion}
- …

## Technical Notes
{Only include this section if there are technical notes. Omit entirely if not.}
```

## Step 4: Return the result

Show the user the created issue ID and URL.
