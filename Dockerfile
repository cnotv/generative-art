ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

COPY . .

RUN npm install -g pnpm && pnpm install

CMD ["pnpm", "run", "host"]
