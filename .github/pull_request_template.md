Closes #

## Summary

<!-- What does this PR do and why? 1–3 sentences. -->

## Key Changes

<!-- Bullet list of files/modules changed and what changed in each. -->

-

## Added on top of the initial plan

<!-- Only conceptual or architectural departures from what the issue described: a reshaped
     API, a changed mechanism, a dropped or added layer, a new convention. One line each,
     briefly. Not a list of everything built — the diff has that. Keep current as commits
     land. Delete section if the work matched the issue in shape. -->

## Faced Difficulties and Learned Lessons

<!-- One line per difficulty, linking the journey doc that explains it. If it needed more
     than a line here, it belonged in documentation/docs/journey/. Delete if straightforward. -->

## Rules and skills to abstract

<!-- Review the work for anything worth generalising, and route it:
     - a mistake a machine could have caught  -> a lint rule, git hook, or test
     - a constraint that will bite anyone working in this area -> the matching .claude/rules file
     - a procedure now done for the second time -> a new skill in .claude/skills/
     - hard-won context explaining why -> a journey doc
     "Nothing generalizable" is a valid and common answer — state it explicitly. -->

## Test Plan

<!-- Checklist of manual and automated steps to verify correctness. -->

- [ ] All unit tests pass (`pnpm test:unit`)
- [ ] Lint passes (`pnpm lint`)
