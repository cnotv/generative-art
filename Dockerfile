ARG NODE_VERSION=20.18.1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /usr/src/app

COPY . .

RUN npm install -g pnpm && pnpm install

# Install Playwright Chromium with system deps (Debian image allows root)
RUN npx playwright install --with-deps chromium

# Build: type-check → vite bundle → Playwright screenshots → route HTML injection
RUN pnpm build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:alpine AS server

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
