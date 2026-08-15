---
sidebar_position: 8
---

# Docker Deployment

## Problems Encountered

- **Orphaned containers blocking the port**: a previous deployment left containers running. The new `docker compose up` started fresh containers but the old ones still held the port, causing a silent bind failure. Fix: always pass `--remove-orphans` to `docker compose up`.
- **Stale `docker-compose.yml` on the server**: the compose file on the server had diverged from the repo, so deployments used old configuration. Fix: always `scp` (or `rsync`) the compose file from the repo to the server as the first deployment step — treat the server's copy as ephemeral.
- **No way to test the fix without touching main**: the deploy workflow only triggered on `main`, making it impossible to verify a fix on a feature branch. Fix: add a `workflow_dispatch` trigger to the deploy workflow so any branch can trigger a manual deploy for verification.
- **`pnpm install --filter <package>` does not install only that package**: the intent was an image holding one small server, and the filtered install pulled the workspace root in with it — the frontend toolchain included — producing a 2.46GB image for a socket relay. The filter selects which projects are _built_, not which manifests are resolved. Fix: build in a stage that is thrown away and copy only the output and its runtime dependency into the final stage. The same image came to 196MB. The general lesson is that an image's size is decided by what the final stage inherits, never by how carefully the install was phrased.
- **A bare `.dockerignore` pattern matches only the repository root**: an entry of `node_modules` does not exclude a nested `packages/<name>/node_modules`, so a package's own symlinked modules travelled into the build context and collided with the ones installed in the image, failing the build on a `COPY`. Fix: give nested paths a recursive glob. Worth remembering because the symptom — a `COPY` refusing to replace a directory with a file — names neither the ignore file nor the package.
- **A registry is not free when the artifact is small**: publishing a server that builds in seconds from a few files buys a round trip, an authentication step on the host, and a second place for a stale `latest` to hide. Building on the host instead keeps the deployed artifact defined entirely by the sources next to the compose file. The cost is that a rollback means redeploying older sources rather than repointing a tag — cheap for a small service, and the trade reverses as build time grows.
