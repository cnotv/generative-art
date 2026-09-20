---
name: start-issue
description: >-
  Use before any code is written, at the start of every request that will change the repo,
  whether or not an issue exists yet — a github.com/.../issues/N URL, "start issue 42", "work on #42", "add an
  option for Y", "let's try X", "fix this bug". Covers reading or writing the issue,
  syncing main, and creating the branch with the right name, before any code is written.
  The draft pull request that follows at the first commit is `open-pr`.
---

# Starting work

This sequence runs in order, before a single line of code or documentation is written.
Every request goes through it, including the smallest fix and the roughest prototype.

## 1. Read or write the issue

An issue that already exists is read properly, comments included:

```sh
gh issue view <number>
```

Otherwise it is written from the request itself, before anything else:

```sh
gh issue create --title "<summary>" --body "..."
```

Keep the body to what and why: what should be true once this lands, and what makes it worth
doing. It is not a plan and not a design doc, and nothing waits on it being approved.

Either way, if the intent, scope or acceptance criteria are unclear, ask one focused question
covering everything that is missing, and wait. Do not guess and do not start implementing
against an assumption — the answer is what the issue gets written from.

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

## 4. Implement, and open the draft pull request at the first commit

Tests first: write the specifications, present them for confirmation, then write the
implementation that satisfies them. An exploratory prototype may go straight to something
running, but still owes its tests before the pull request is marked ready.

There is no plan comment and nothing to wait for. The first commit is followed straight
away by the draft pull request (`open-pr`), which is where the decisions are recorded as
they are made.

## Keep the issue current while you work

The issue is the record of what was decided, not just what was asked for. Post a comment
when any of these happens, rather than letting it describe work that is no longer the work:

- a discovery or architectural insight that changes how the work is being done
- a departure from what the issue asked for, with the reason
- a question that blocks progress, or the answer once you have it
- scope arriving or being dropped

If the change invalidates the original description rather than adding to it — a different
file tree, a different approach, a renamed artifact — edit the issue body with
`gh issue edit <number>` so it describes the current state.

**Edit the body; do not narrate the edit.** An issue that defines something should read as
one clean, current description, not a description followed by a changelog of how it got
there. The revision history is already in GitHub if anyone needs it. Comments are for
findings, questions and decisions that are not yet in the body — never for announcing that
the body changed.

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
up-to-date main, and the issue it is named after is open and describes what and why. Note
that the commit subjects must never reference the issue number — the branch name already
carries it.
