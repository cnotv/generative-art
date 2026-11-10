ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /usr/src/app

COPY . .

# Vite inlines these at build time, so they have to exist before `pnpm build`, not at run time
ARG VITE_UMAMI_WEBSITE_ID
ARG VITE_SENTRY_DSN

RUN npm install -g pnpm@9 && pnpm install && pnpm build

CMD ["pnpm", "run", "host"]
