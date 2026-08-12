---
sidebar_position: 17
---

# Deploying the multiplayer server

The Socket.IO server from `@webgamekit/multiplayer-server` runs as its own container,
separate from the website. It is **built on the host it runs on** — no image is ever pushed
to or pulled from a container registry.

:::note Source files
`Dockerfile.server`, `docker-compose.yml`, `.github/workflows/deploy.yml`,
`packages/multiplayer-server/`
:::

## Why no registry

The image is small and builds in seconds from a handful of TypeScript files, so publishing
it would add a registry round trip, an authentication step on the host, and a second place
for a stale `latest` tag to hide — in exchange for nothing. Building on the host keeps the
deployed artifact defined entirely by the sources sitting next to the compose file.

The website image is still pulled from GHCR; only the multiplayer server is built locally.

## What travels to the host

`Dockerfile.server` reads nothing outside `packages/multiplayer-server`, so three paths are
the complete build context:

| Path                          | Why it is needed                                 |
| ----------------------------- | ------------------------------------------------ |
| `docker-compose.yml`          | service definition, ports, environment           |
| `Dockerfile.server`           | the build recipe                                 |
| `packages/multiplayer-server` | the sources and the manifest listing `socket.io` |

The host never needs a git checkout of the repository, and never needs pnpm or the
monorepo — the package builds standalone because its devDependencies are self-contained and
it has no workspace dependencies.

## Automatic deployment

Pushing to `main` runs `.github/workflows/deploy.yml`, which copies those three paths to the
server and then runs, in the deployment directory:

```bash
docker compose pull website          # the website image still comes from the registry
docker compose up -d --build --force-recreate --remove-orphans
```

`--build` rebuilds the multiplayer server from the sources just copied. `--remove-orphans`
clears containers left behind by earlier service names, which has previously caused a silent
port bind failure — see [Docker Deployment](../journey/docker-deployment.md).

The workflow needs the usual secrets: `HETZNER_HOST`, `HETZNER_USERNAME`, `HETZNER_SSH_KEY`,
`HETZNER_PORT` (optional, defaults to 22) and `HETZNER_TARGET_DIR`.

## Manual deployment

To deploy from a working copy without waiting for CI, copy the same three paths and build:

```bash
scp -r docker-compose.yml Dockerfile.server packages/multiplayer-server \
  user@host:/srv/generative-art/

ssh user@host 'cd /srv/generative-art && docker compose up -d --build multiplayer-server'
```

## Running it locally

Through compose, exactly as deployed — it listens on 3001:

```bash
docker compose up -d --build multiplayer-server
docker compose logs -f multiplayer-server
```

Or directly, on whichever port suits. The demo view at `/experiments/MultiplayerClient`
defaults to `http://localhost:3000`, so mapping to 3000 lets it connect without editing the
field:

```bash
docker build -f Dockerfile.server -t multiplayer-server:local .
docker run --rm -p 3000:3000 multiplayer-server:local
```

Without Docker at all:

```bash
pnpm --filter @webgamekit/multiplayer-server build
PORT=3000 pnpm --filter @webgamekit/multiplayer-server start
```

## Configuration

| Variable   | Default | Meaning                                    |
| ---------- | ------- | ------------------------------------------ |
| `PORT`     | `3000`  | Port the server listens on                 |
| `NODE_ENV` | unset   | Set to `production` by the compose service |

Compose sets `PORT: 3001` so the server does not collide with the website on 3000. The
published port and `PORT` must match — the container maps `3001:3001`, not `3001:3000`.

## Operational notes

- The container runs as the unprivileged `node` user.
- The entrypoint handles `SIGTERM`, so `docker stop` returns in about a second rather than
  waiting out Docker's ten second kill timeout. A stop that consistently takes ten seconds
  means the signal handler is no longer wired up.
- `restart: unless-stopped` brings it back after a host reboot or a crash.
- The registry holds no copy of this image, so a rollback means deploying the older sources
  and rebuilding — there is no previous tag to repoint to. For a server this small that is
  a `git checkout` and one `docker compose up -d --build`.

## Verifying a deployment

The server logs its port on startup:

```bash
docker compose logs multiplayer-server   # multiplayer-server listening on port 3001
```

For an end-to-end check, point the demo view at the deployed URL and open it in two tabs:
each tab should appear in the other's player list, and closing one should drop it from the
other's list within a moment.
