---
description: Create a new YouTrack task in the TM project with a consistent description format
argument-hint: [summary]
---

# task — Create a YouTrack issue

## Step 1: Get the summary

**If `$ARGUMENTS` is provided**, use it as the task summary.

**If no argument was given**, ask the user what the task is about in one sentence.

## Step 2: Gather details through conversation

Ask the user for the following — you may ask all at once or conversationally depending on how much context you already have:

1. **Short description**: 1–3 sentences explaining what this task is and why it exists.
2. **Acceptance criteria**: A list of specific, testable conditions that define "done". Ask the user to describe what should be true when the task is complete, and help them turn vague answers into clear criteria.
3. **Technical notes** *(optional)*: Implementation details, constraints, library choices, or references. Skip this section entirely if there are none.

If the user's answers are vague or incomplete, ask a focused follow-up. Don't proceed to creation until the acceptance criteria are clear enough to be actionable.

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
