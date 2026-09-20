---
name: open-pr
description: >-
  Use when a change reaches its first commit, to open its draft pull request — per AGENTS.md
  every request opens one, without waiting to be asked — and again when the change is
  validated, to mark it ready. Also when explicitly asked to open, raise, create, submit or
  update one: "open the PR", "raise a PR", "make a pull request", "push this up", "update
  the PR description". Covers the issue the PR closes, rebasing onto main, force-pushing
  safely, the PR body format, keeping the description current after each push, watching CI
  to green, and the abstraction review that closes out the work.
---

# Opening a pull request

The pull request opens as a draft at the first commit, not at the end: it is where the
decisions are recorded while they are still being made. It is marked ready once the change
is validated (`finish-change` passed) and its checks are green. Neither step waits to be
asked.

## 0. The issue it closes

The PR title and body both need an issue number (step 3), and `start-issue` has already
opened or read that issue before the branch existed. If somehow no issue exists, write it
now, covering what is being built and why, before opening the PR.

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
gh pr create --draft --title "<type>: <summary> (#<issue-number>)" --body-file <file>
```

`--draft` while the work is still moving; `gh pr ready` once it is validated and green. A
draft opened at the first commit describes what is being done and why, and is updated as
the work lands rather than rewritten at the end.

The issue number belongs in the PR title, so it appears on merge. The body follows
`.github/pull_request_template.md` and starts with `Closes #<issue-number>`, which links
and closes the issue automatically. Do not restate the template here — it is the single
source for the format.

**Always open with In short.** The first section is a brief introduction written for a reader
with ADHD: someone who will read those few lines and nothing else, so they must carry the whole
point on their own. Three to five bullets, one idea each, short sentences and plain words, the
most important thing first. Say what changed, why it matters to the person using it, and the
one core idea that made it work; if one change mattered far more than the rest, name it
outright rather than letting it hide among the others. No jargon, no hedging, no background.

**Write only what the diff cannot say.** A reviewer has the code; an agent picking this up
in six months does not have your reasoning. So the body carries decisions, constraints and
surprises — never a tour of what changed. If a point is already explained in a doc, a rule
or a code comment, link it in a clause rather than repeating the explanation. One line per
point is the default; spend a paragraph only where the thing was genuinely surprising.

A body long enough to skim past has failed, however accurate it is.

Two sections need care:

- **Added on top of the issue** — only the **conceptual or architectural** departures
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

**After writing the body, re-fetch the PR and confirm the image actually renders** — never
trust that the markup you wrote is what got stored. A stray escape (quoted backticks or
quotes wrapped around the URL, a mangled character) turns `![alt](url)` into literal text
with no image, and it looks identical to a working link in the tool call that wrote it. Read
the body back and check the image line is exactly `![alt](raw-url)`, no extra characters
inside the parentheses.

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

Once `deploy/netlify` succeeds, take its preview link (`targetUrl` in
`gh pr view <number> --json statusCheckRollup`) and append the route to the view being
changed — `/tools/RigAnimator`, not the bare root — so it opens straight to the state being
demonstrated. Put the full URL into the **Preview** line at the top of the PR body (the
template carries the placeholder) and edit it in via step 5, the same as any other body
update; do not only mention it in the chat reply, which the next reader of the PR never sees.

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
linked issue still describes the work accurately, the abstraction review section is filled
in — including when the answer is that nothing generalizes — and any embedded screenshot or
video was confirmed to render, not just written.
