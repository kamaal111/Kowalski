---
name: kowalski-server-typescript
description: Repository-specific patterns for Kowalski's TypeScript server built with Hono, Zod, Drizzle, and structured Pino logging. Use when changing files under `server/src/**`, adding or updating API endpoints, request/response schemas, middleware, auth flows, services, repositories, database-backed behavior, or server integration tests.
---

# Kowalski Server Typescript

## Overview

Follow this skill to match the server's existing architecture instead of inventing a parallel one. Prefer repository-specific patterns from nearby feature folders over generic Node or Hono habits.

## Start Here

- Run `just` from the repository root first and prefer root `just` recipes over ad hoc commands.
- Read the nearest existing feature module before editing. The portfolio, auth, stocks, and forex folders show the expected server shape.
- Keep changes scoped to the existing feature slices under `server/src/<feature>/`.
- Avoid starting the server directly. Use compile, test, and OpenAPI workflows instead.

## Non-Negotiable Rules

- Validate all external or unknown data with Zod. Parse environment variables, request bodies, response bodies, auth payloads, database-adjacent unknowns, and third-party API data at the boundary.
- Avoid `console.*` in `server/src/**`. Use the shared logger from `server/src/logging/`.
- Avoid `as` casts, suppression comments, and lint bypasses. Fix the type or validate the data instead.
- Reuse shared constants from `server/src/constants/` and shared schemas from `server/src/schemas/` when they fit.
- Use integration tests for route and persistence behavior unless the change is truly isolated.

## Architectural Shape

Use the established flow:

- Define the OpenAPI contract in `routes/` with `createRoute(...)`.
- Define request and response Zod schemas in `schemas/`.
- Read validated request data in `handlers/` with `c.req.valid(...)`.
- Delegate business logic to `services/`.
- Keep database access in `repositories/`.
- Throw domain exceptions when required persistence work fails.
- Parse handler responses through the response schema before returning them.

Model new work after files such as:

- `server/src/portfolio/routes/create-entry.ts`
- `server/src/portfolio/handlers/create-entry.ts`
- `server/src/portfolio/services/create-entry.ts`
- `server/src/portfolio/repositories/create-entry.ts`
- `server/src/portfolio/tests/create-entry.integration.test.ts`

## Route and Schema Patterns

- Describe endpoints with `@hono/zod-openapi` instead of undocumented Hono handlers.
- Attach request headers, request bodies, response bodies, status codes, tags, and descriptions in the route definition.
- Keep schema naming explicit and reusable. Use shared schema fragments when the shape is already defined elsewhere.
- Use `.parse(...)` for values that must be correct and `.safeParse(...)` when a graceful branch is required.
- Treat response mapping as a validation boundary too. The handlers in portfolio routes parse the response shape right before `c.json(...)`.

## Middleware, Context, and Auth Patterns

- Prefer context-injected dependencies over global singletons. The server expects things like `db`, `auth`, `logger`, `requestId`, and `session` to flow through Hono context.
- Use shared auth helpers such as `getSessionWhereSessionIsRequired(...)` once middleware guarantees a session.
- Update request logging context when the route or authenticated user becomes known. Use helpers such as `setRequestRoute(...)`, `setRequestUserId(...)`, and `withRequestLogger(...)`.
- Keep middleware focused. Reuse `allowedModes(...)`, auth middleware, cache middleware, and the centralized error handler instead of duplicating their logic.

## Repository and Persistence Patterns

- Use narrow Drizzle selects and return only the fields the next layer needs.
- Prefer repository-local input and output types derived from `table.$inferInsert` and `table.$inferSelect`.
- Check `returning(...)` results explicitly and throw domain exceptions when no row comes back.
- Keep persistence shape concerns in the repository layer and business orchestration in the service layer.
- Use helper functions for repeated conversions such as transaction date normalization.

## Logging Patterns

- Use `getComponentLogger(...)`, `logInfo(...)`, `logWarn(...)`, and `logError(...)` from the shared logging module.
- Emit flat structured fields only. Prefer scalars or arrays of scalars.
- Include meaningful event names such as `portfolio.entry.created` or `request.validation.failed`.
- Include standard fields when relevant: `component`, `event`, `route`, `request_id`, `user_id`, `status_code`, `duration_ms`, `outcome`, `error_code`, `error_name`.
- Avoid secrets, tokens, cookies, raw bodies, or other sensitive payloads in logs.
- Add or update tests when logging behavior changes. The repository has explicit logging policy coverage.

## Testing Patterns

- Prefer the existing integration harness from `server/src/tests/fixtures` and helpers from `server/src/tests/`.
- Parse response bodies in tests with the same Zod schemas used by production code.
- Assert behavior across the full path when it matters: HTTP status, response body, persisted database state, and emitted logs.
- Reuse helper constructors for authenticated requests, request IDs, and fixtures instead of rebuilding them in each test.
- Keep regression tests focused and descriptive.

## API and OpenAPI Workflow

- Update route schemas first when the API contract changes.
- Run `just download-spec` after API changes instead of hand-editing generated client inputs.
- Expect downstream Swift client code to depend on the generated OpenAPI surface.
- Prefer asking the user to start the server if spec download requires a live server instead of relying on auto-start behavior.

## Verification Workflow

- Run the narrowest useful command while iterating:
  - `just compile-server` for compile-level server changes
  - `just typecheck` for type-driven changes
  - `just lint` or `just format-check` when relevant
  - `just test` for behavior changes
- Run `just ready` from the repository root before declaring completion on server code changes.
- If the change is docs-only inside skills or guidance files, skip `just ready` unless the user explicitly asks for it.

## Expected Output When Using This Skill

Finish by stating:

- which server patterns you followed
- which files or layers you touched
- which commands you ran
- whether `just ready` passed, or why it was not run
