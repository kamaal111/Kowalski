# Built from the repository root so the pnpm workspace (which owns every dependency version)
# is part of the build context:
#   docker build -f server/Dockerfile .
FROM node:26-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
RUN pnpm install --frozen-lockfile

FROM deps AS production-deps

RUN pnpm prune --prod

FROM node:26-bookworm-slim AS runtime

ENV NODE_ENV="production"
ENV CACHE_DIR="/tmp/cache"

WORKDIR /app

COPY --chown=node:node --from=production-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=production-deps /app/server/node_modules ./server/node_modules
COPY --chown=node:node package.json pnpm-workspace.yaml ./
COPY --chown=node:node server/package.json ./server/
COPY --chown=node:node server/src ./server/src

EXPOSE 8082

USER node

WORKDIR /app/server

# Node runs the TypeScript sources directly; there is no build output.
CMD ["node", "."]
