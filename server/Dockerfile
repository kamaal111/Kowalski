FROM node:24-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build

COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run compile

FROM deps AS production-deps

RUN pnpm prune --prod

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV="production"

WORKDIR /app

COPY --chown=node:node --from=production-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node package.json ./

EXPOSE 8080

USER node

CMD ["node", "dist/src/index.js"]
