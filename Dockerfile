ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-alpine as base

WORKDIR /usr/src/app

COPY . .

RUN yarn install

CMD ["yarn", "run", "host"]
