---
name: start-issue
description: >-
  Use when a GitHub issue is linked or referenced and work on it is about to begin — a
  github.com/.../issues/N URL, "start issue 42", "work on #42", "pick up this ticket",
  "implement this issue". Covers reading the issue, syncing main, creating the branch with
  the right name, and posting the implementation plan as an issue comment before any code
  is written. Do not use for exploratory prototypes that have no issue yet.
---

# Starting work from a GitHub issue

This sequence runs in order, before a single line of code or documentation is written.

## 1. Read the issue

```sh
gh issue view <number>
```

Read it properly, including the comments. If the intent, scope or acceptance criteria are
unclear, ask one focused question covering everything that is missing, and wait. Do not
guess and do not start implementing against an assumption.

## 2. Sync main

```sh
git checkout main
git fetch origin main
git rebase origin/main
```

Rebase, never `git pull` — `pull` merges by default, which puts merge commits on main and
causes lockfile churn.

## 3. Create the branch

```sh
git checkout -b <type>/<number>-<slug>
```

- `type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- `slug` is a two or three word kebab-case summary of the issue title

Always a fresh branch from main. Never commit to the current branch, and never reuse an
existing feature branch, even if it looks related.

## 4. Post the plan

```sh
gh issue comment <number> --body "..."
```

Using this shape:

```markdown
## Implementation Plan

### Changes

- `path/to/file.ts` - what changes and why

### Approach

Brief explanation of the chosen approach.

### Questions

- [ ] Anything that needs clarifying
```

For non-trivial work, wait for confirmation before implementing.

## 5. Implement

Tests first: write the specifications, present them for confirmation, then write the
implementation that satisfies them.

## Breaking a large issue into subtasks

Use GitHub's native sub-issue relationship, not just a checklist in the body. Create each
subtask as a standalone issue first, then attach it:

```sh
gh api --method POST \
  repos/cnotv/generative-art/issues/<parent-number>/sub_issues \
  -f sub_issue_id=<child-number>
```

The parent body may still carry a `- [ ] #N — description` checklist for quick scanning, but
the relationship has to exist through the API for GitHub to track progress natively and
close out the parent's progress bar as subtasks land.

## Definition of done

`git branch --show-current` reports `<type>/<number>-<slug>`, the branch is based on an
up-to-date main, and the issue carries a plan comment posted before any implementation
commit. Note that the commit subjects must never reference the issue number — the branch
name already carries it.
