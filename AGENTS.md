# Repository Guidelines

## Start Here

- Run `just` from the repository root first so you can discover the current command surface and prefer repo recipes over ad hoc commands.
- Run commands from the repository root unless a command explicitly requires a package directory.
- Look for existing patterns before writing code. Match surrounding structure, naming, validation, error handling, and test style unless there is a strong reason to introduce something new.

## Use The Relevant Skill

When a task matches one of these areas, load the skill and follow it instead of relying on duplicated instructions in this file:

- **Git worktree workflow:** `.agents/skills/kowalski-git-worktree/SKILL.md`
  - Use for detached `HEAD`, branch sync, rebasing, amending, force-pushing, upstream tracking, worktree env setup, or PR updates from a linked worktree.
- **Server changes:** `.agents/skills/kowalski-server-typescript/SKILL.md`
  - Use for `server/src/**`, API endpoints, schemas, handlers, middleware, services, repositories, logging, OpenAPI-backed routes, and server integration tests.
- **App and Swift package changes:** `.agents/skills/kowalski-app-swift/SKILL.md`
  - Use for `app/**`, SwiftUI screens, feature models, client wrappers, design-system components, previews, package manifests, and Swift tests.
- **Testing workflow:** `.agents/skills/testing-best-practices/SKILL.md`
  - Use when adding tests, fixing regressions, debugging failures, or deciding how to validate behavior.
- **Dependency upgrades:** `.agents/skills/kowalski-dependency-upgrade/SKILL.md`
  - Use for pnpm, SwiftPM, generated OpenAPI client inputs, or cross-stack dependency churn.

## Critical Development Rules

- **ALWAYS verify your work with relevant commands before claiming completion**
  - Run the narrowest useful checks while iterating.
  - Run `just ready` from the repository root as the final verification for code changes.
  - For docs-only changes, such as `AGENTS.md`, `README.md`, or skill files, do not run `just ready` unless the user explicitly asks for it.
- **NEVER claim code changes are done until `just ready` passes**
  - If `just ready` fails, fix the issues and rerun it until it succeeds.
- **ALWAYS include proof of work in the final response**
  - Tell the user exactly how you validated the work.
  - List the commands, builds, tests, or manual checks you ran.
  - If you skipped validation, say so explicitly and why.
- **ALWAYS write review-friendly commit messages when a commit is requested or required**
  - Use a declarative title.
  - Include a body that explains the scope, important files, and intent.
- **ONLY use non-destructive git operations in the main worktree**
  - Read-only inspection commands are fine.
  - Do not run destructive or state-changing git commands in the user's active worktree.
  - If state-changing git work is required, do it in a dedicated worktree and follow the worktree skill.
- **ALWAYS use `pnpm` for Node.js work**
  - Do not use `npm` or `yarn` anywhere in this repository.
- **ALWAYS use root `just` commands when they exist**
  - Prefer repo recipes over custom command sequences for build, test, quality, database, and OpenAPI workflows.
- **NEVER start the server directly or as a background process**
  - Do not use `node ... &`, `pnpm start &`, `tsx ... &`, or similar patterns.
  - Only use `just dev-server` if the user explicitly asks you to start the server.
- **NEVER suppress lint or type errors**
  - Do not add lint-disable comments, `@ts-ignore`, or `@ts-expect-error`.
- **NEVER use TypeScript type assertions or casting**
  - Do not use `as Type` or `<Type>value`.
- **ALWAYS validate unknown or external data**
  - Use Zod at boundaries instead of forcing types through.
- **ALWAYS enforce user ownership when querying user-scoped resources**
  - Do not query by client-supplied resource IDs alone when the resource should belong to the authenticated user.
  - Scope reads and writes through the requesting user's owned parent record or an equivalent ownership constraint in the query itself.
  - Treat any uncertainty about ownership as a real security bug, not a follow-up cleanup.
- **NEVER hide required dependency failures behind misleading success responses**
  - If required derived data is missing, fail clearly instead of returning a superficially valid response that breaks downstream assumptions.
- **NEVER manually edit `.xcstrings` files**
  - Update `NSLocalizedString` calls in Swift and let Xcode manage the localization catalogs.

## Verification Commands

- Use `just lint` for linting changes.
- Use `just format` or `just format-check` for formatting changes.
- Use `just typecheck` for TypeScript type changes.
- Use `just compile-server` for server compilation changes.
- Use `just test` for server or app behavior changes.
- Use `swift build` in the affected package directory for Swift package changes.
- Run `just test-ui` only when a human explicitly requests app UI test coverage.
- Run `just ready` last for code changes.

## Additional Repository Requirements

- Follow `.specify/memory/constitution.md`.
- For OpenAPI work, update server schemas first and run `just download-spec` after API changes.
- `just download-spec` generates the spec directly from the server app. Do not start the server just to fetch `/spec.yaml`.

## Security And Configuration Facts

- Create `.env` in the repository root from `.env.example` when needed.
- In linked worktrees, prefer `just setup-worktree-env` so the worktree gets isolated ports, database settings, and both required env files.
- Required server values:

```bash
DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:8080
```

- Database service defaults:
  - Host: `localhost:5432`
  - Database: `kowalski`
  - User: `kowalski_user`
  - Password: `kowalski_password`
- Prerequisites:
  - Node.js `24+`
  - pnpm `10+`
  - Docker
  - Xcode `16.3+`
  - `just`

## Documentation Endpoints

- Swagger UI: `http://localhost:8080/doc`
- JSON spec: `http://localhost:8080/spec.json`
- YAML spec: `http://localhost:8080/spec.yaml`
