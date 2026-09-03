---
name: open-pr
description: >-
  Use when explicitly asked to open, raise, create, submit or update a pull request — "open
  the PR", "raise a PR", "make a pull request", "push this up", "update the PR description".
  Covers rebasing onto main, force-pushing safely, the PR body format, keeping the
  description current after each push, watching CI to green, and the abstraction review
  that closes out the work. Never open a pull request unless it was explicitly requested.
---

# Opening a pull request

A pull request is only ever opened on explicit request. If nobody asked for one, the work
ends at the last commit.

## 1. Rebase onto main

```sh
git fetch origin main
git rebase origin/main
```

Resolve any conflicts. Never `git pull`, and never rebase onto the remote feature branch —
always onto main. CI fails if the branch is behind.

```sh
git push --force-with-lease
```

`--force-with-lease`, never `--force`: it refuses when someone else has pushed in the
meantime, instead of destroying their work.

## 2. Run the abstraction review

Before the PR is marked ready, look back over the work and ask what should outlive it.
Route each item by how it would be enforced:

| What came up                                            | Where it belongs                   |
| ------------------------------------------------------- | ---------------------------------- |
| A mistake a machine could have caught                   | a lint rule, a git hook, or a test |
| A constraint that will bite anyone working in this area | the matching `.claude/rules/` file |
| A procedure now performed for the second time           | a new skill in `.claude/skills/`   |
| Hard-won context explaining why                         | a journey doc                      |
| Nothing generalizable                                   | say so explicitly                  |

"Nothing generalizable" is a valid and common answer. Writing it down is what stops the
section from becoming a place to invent rules nobody needed.

## 3. Open it

```sh
gh pr create --title "<type>: <summary> (#<issue-number>)" --body-file <file>
```

The issue number belongs in the PR title, so it appears on merge. The body follows
`.github/pull_request_template.md` and starts with `Closes #<issue-number>`, which links
and closes the issue automatically. Do not restate the template here — it is the single
source for the format.

**Write only what the diff cannot say.** A reviewer has the code; an agent picking this up
in six months does not have your reasoning. So the body carries decisions, constraints and
surprises — never a tour of what changed. If a point is already explained in a doc, a rule
or a code comment, link it in a clause rather than repeating the explanation. One line per
point is the default; spend a paragraph only where the thing was genuinely surprising.

A body long enough to skim past has failed, however accurate it is.

Two sections need care:

- **Added on top of the initial plan** — only the **conceptual or architectural** departures
  from what the issue described: a reshaped API, a changed mechanism, a dropped or added
  layer, a new convention. One line each. Not a list of everything built — the diff has
  that, and the issue already said what was asked for. If the work matched the issue in
  shape, delete the section. Keep it current as new commits land.
- **Rules and skills to abstract** — the output of step 2.

## 3b. Show the change if it renders

**A pull request that changes anything visible carries a picture of it.** A view, a transition, a
material, a camera, a panel, a layout — a reviewer should not have to check out the branch and
run the app to find out what it looks like.

- **Stills** for a state or a comparison, **video** when the point is motion.
- Capture from the running app, never a mock-up. The recipe — driving the app, waiting long
  enough for a 3D scene to exist, trimming a recording — is in
  `documentation/docs/guides/capturing-documentation-media.md`.
- Show the **before** as well when the change alters something that already existed. "It looks
  like this now" is half an argument; the other half is what it replaced.
- Include the same media in the documentation, per `.claude/rules/docs.md`. The pull request is
  read once and the docs are read for years, so the media belongs in both.

Committing the media into `documentation/static/` and linking it by raw URL is what makes it show
in the body:

```markdown
![What the reader is looking at](https://raw.githubusercontent.com/cnotv/generative-art/<sha>/documentation/static/img/<feature>/<name>.webp)
```

Pin the link to the **commit sha**, not the branch: a branch link dies when the branch is deleted
on merge, and the pull request is the record afterwards. GitHub will not play a `.webm` linked
this way, so link the file for a video and keep the stills inline.

## 4. Watch CI

```sh
gh pr checks <number> --watch
```

If a check fails, read the actual failure before changing anything:

```sh
gh run view <run-id> --log-failed
```

Fix the cause, commit, push, and repeat until every check passes. Never bypass hooks with
`--no-verify` — if a hook fails, the hook is usually right.

Once `deploy/netlify` succeeds, hand over its preview link (`targetUrl` in
`gh pr view <number> --json statusCheckRollup`) rather than making the reader dig for it.
Append any query parameter the change relies on, so the link opens straight to the state
being demonstrated instead of the bare root.

Whenever a pull request exists for the work, end the report with a link to it too, so it is
one click away rather than something the reader has to go find.

## 5. Keep the PR and the issue current

After every subsequent push, update **both**:

```sh
gh pr edit <number> --body-file <file>      # the PR body
gh issue edit <number> --body-file <file>   # the issue, when its description is now wrong
```

A description that lags behind its commits is worse than no description, because it is read
as current. This applies to the issue as much as the PR: if the work changed the shape of
what was proposed — a different file layout, a different mechanism, a dropped deliverable —
the issue body is now misinformation for anyone who reads it later.

Edit the body itself rather than appending a comment about it. Both the issue and the PR
should read as one clean, current description; a changelog of how the description evolved
belongs in the revision history, which GitHub keeps for you.

Do this as part of the push, not as a final tidy-up. The moment you postpone it is the moment
it stops happening.

## Definition of done

Every CI check is green, the PR description matches what is actually on the branch, the
linked issue still describes the work accurately, and the abstraction review section is
filled in — including when the answer is that nothing generalizes.
