---
name: kowalski-server-typescript
description: Repository-specific overlay for Kowalski's TypeScript server built with Hono, Zod, Drizzle, and structured Pino logging. Use with `typescript-server-best-practices` when changing files under `server/src/**`, adding or updating API endpoints, request or response schemas, middleware, auth flows, services, repositories, database-backed behavior, or server integration tests.
---

# Kowalski Server Typescript

## Overview

Load [typescript-server-best-practices](../typescript-server-best-practices/SKILL.md) first. Use this skill for Kowalski's feature layout, helper names, logging entrypoints, test harness locations, and OpenAPI workflow.

## Follow Kowalski's Server Shape

- Read the nearest existing feature module before editing. The portfolio, auth, stocks, and forex folders show the expected shape.
- Keep changes scoped to the existing feature slices under `server/src/<feature>/`.
- Model new work after files such as:
  - `server/src/portfolio/routes/create-entry.ts`
  - `server/src/portfolio/handlers/create-entry.ts`
  - `server/src/portfolio/services/create-entry.ts`
  - `server/src/portfolio/repositories/create-entry.ts`
  - `server/src/portfolio/tests/create-entry.integration.test.ts`

## Reuse Kowalski-Specific Server Helpers

- Define route contracts with `@hono/zod-openapi`.
- Type handlers with `HonoContext<..., { out: ... }>` so `c.req.valid(...)` stays strongly typed without casts.
- Reuse shared constants from `server/src/constants/` and shared schemas from `server/src/schemas/` when they fit.
- Reuse auth and request-context helpers such as `getSessionWhereSessionIsRequired(...)`, `setRequestRoute(...)`, `setRequestUserId(...)`, `withRequestLogger(...)`, and `allowedModes(...)`.
- Use the shared logging module in `server/src/logging/`, including helpers such as `getComponentLogger(...)`, `logInfo(...)`, `logWarn(...)`, and `logError(...)`.
- Never assume a client-supplied portfolio, transaction, or other resource ID belongs to the requester just because the user is authenticated.

## Follow Kowalski's Persistence And Test Setup

- Keep database access in feature repositories and business orchestration in feature services.
- Resolve the authenticated user's owned parent record first, then query nested resources through that owned record or an equivalent user-scoped repository method.
- Keep ownership checks inside the query path itself so another user's resource ID cannot be used to read or mutate data.
- Use the integration harness from `server/src/tests/fixtures` and helpers from `server/src/tests/`.
- Expect server integration tests to create a temporary Postgres database and run the current Drizzle migrations from `server/drizzle/`.
- Add or update regression coverage for cross-user access whenever you touch ownership-sensitive routes, handlers, services, or repositories.

## Respect Kowalski's OpenAPI Workflow

- Update route schemas first when the API contract changes.
- Run `just download-spec` after API changes instead of hand-editing generated client inputs.
- Expect downstream Swift code to depend on `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml`.
- Keep spec generation on the in-process `just download-spec` path instead of starting the server to fetch `/spec.yaml`.

## Verify In Kowalski's Workflow

- Run the narrowest useful command while iterating:
  - `just compile-server` for compile-level server changes
  - `just typecheck` for type-driven changes
  - `just lint` or `just format-check` when relevant
  - `just test` for behavior changes
- Run `just ready` from the repository root before declaring completion on server code changes.
- Skip `just ready` only for docs-only work when the repository rules allow it.

## Expected Output When Using This Skill

Finish by stating:

- which Kowalski server layers or helper patterns you followed
- which files or feature slices you touched
- which commands you ran
- whether `just ready` passed, or why it was not run
