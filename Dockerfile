ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-alpine AS base

WORKDIR /usr/src/app

COPY . .

RUN npm install -g pnpm@9 && pnpm install && pnpm build

CMD ["pnpm", "run", "host"]
