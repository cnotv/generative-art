---
sidebar_position: 8
---

# Docker Deployment

## Problems Encountered

- **Orphaned containers blocking the port**: a previous deployment left containers running. The new `docker compose up` started fresh containers but the old ones still held the port, causing a silent bind failure. Fix: always pass `--remove-orphans` to `docker compose up`.
- **Stale `docker-compose.yml` on the server**: the compose file on the server had diverged from the repo, so deployments used old configuration. Fix: always `scp` (or `rsync`) the compose file from the repo to the server as the first deployment step — treat the server's copy as ephemeral.
- **No way to test the fix without touching main**: the deploy workflow only triggered on `main`, making it impossible to verify a fix on a feature branch. Fix: add a `workflow_dispatch` trigger to the deploy workflow so any branch can trigger a manual deploy for verification.
