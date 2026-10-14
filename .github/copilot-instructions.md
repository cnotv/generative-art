# Generative Art - WebGameKit Project

The rules for this repo live in [`AGENTS.md`](../AGENTS.md) at the repository root. Read it
first — it holds the working agreements, the code and git rules, the definition of done, and
an index of everything else.

Rules for a specific area load automatically from `.claude/rules/`, scoped by the `paths:`
glob in each file. The workflow procedures (starting an issue, verifying a change, opening a
pull request) come from agent-base's `workflow` plugin, which `.claude/settings.json`
installs; the procedures only this repository needs are skills in `.claude/skills/`. This
editor discovers both directories natively, which is why they are not duplicated under
`.github/`.

Nothing else belongs in this file. Keeping the rules in one place is what stops the copies
from drifting apart.
