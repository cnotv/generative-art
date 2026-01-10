# WebGameKit Documentation

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

## Quick Start

```bash
# From project root
pnpm docs

# Or from documentation folder
pnpm start
```

This starts a local development server at `http://localhost:3000`. Most changes are reflected live without restarting the server.

## Build

```bash
yarn build
```

This command generates static content into the `build` directory and can be served using any static contents hosting service.

## Deployment

Using SSH:

```bash
USE_SSH=true yarn deploy
```

Not using SSH:

```bash
GIT_USER=<Your GitHub username> yarn deploy
```

If you are using GitHub pages for hosting, this command is a convenient way to build the website and push to the `gh-pages` branch.
