# Repository Guidelines

## Critical Development Rules

- **ALWAYS verify your work with relevant commands before claiming completion**
  - For linting changes: run `just lint`
  - For formatting changes: run `just format` or `just format-check`
  - For TypeScript type changes: run `just typecheck`
  - For server compilation changes: run `just compile-server`
  - For server or app behavior changes: run `just test`
  - Run `just test-ui` only when a human explicitly requests app UI test coverage
  - For Swift package changes: run `swift build` in the affected package directory
  - **ALWAYS run `just ready` from the repository root as the final verification before finishing code changes**
  - For docs-only changes, such as `AGENTS.md`, `README.md`, or other guidance files, do not run `just ready` unless the user explicitly asks for it
- **NEVER claim code changes are done until `just ready` passes**
  - `just ready` runs quality checks, downloads the OpenAPI spec, and runs server plus non-UI app tests
  - If `just ready` fails, fix the issues and re-run it until it succeeds
  - This is non-negotiable
- **ALWAYS include proof of work in the final response**
  - Tell the user exactly how you validated the work
  - List the commands, builds, tests, or manual checks you ran
  - If you did not run a validation step, say that explicitly instead of implying it passed
  - For docs-only changes, say that no code validation was run and why
- **ALWAYS write review-friendly commit messages when a commit is requested or required**
  - Use a declarative commit title that clearly states what the commit does
  - Include a detailed commit description/body that captures the full scope of the change, including the important files, behaviors, and intent
  - Assume reviewers will inspect every commit individually, and make each commit message complete enough to support that commit-by-commit review
- **ONLY use non-destructive git operations in the main worktree**
  - Read-only git commands for inspection or debugging are allowed, such as `git status`, `git diff`, `git log`, `git show`, and `git blame`
  - Do not run destructive or state-changing git commands in the current worktree, such as `git checkout`, `git reset`, `git stash`, `git revert`, or `git rebase`
  - If changes need to be undone, prefer making the correcting edits directly
  - If destructive git operations are genuinely required to complete the task, do that work in a separate worktree instead of the user's active worktree
- **When working in a dedicated git worktree, follow the repository worktree workflow**
  - Use `.agents/skills/kowalski-git-worktree/SKILL.md` when the task involves detached `HEAD`, branch sync, rebasing, amending, force-pushing, or PR updates from a worktree branch
  - Start by checking `git status --short`, `git rev-parse --abbrev-ref HEAD`, `git branch -vv`, and recent commits
  - Run `just setup-worktree-env` before any recipe that touches PostgreSQL, server ports, or OpenAPI download so the worktree uses its own Compose project, database port, and `server/.env`
  - If the worktree is detached, run `git switch <expected-branch>` before pulling, committing, or pushing
  - If `git pull --rebase` reports missing tracking information, set it with `git branch --set-upstream-to=origin/<branch> <branch>` and retry
  - After `git commit --amend`, prefer `git push --force-with-lease origin <branch>` to update the PR branch safely
  - Publish worktree changes as a GitHub pull request for review unless the user explicitly says not to create one
  - In linked worktrees, `git switch`, `git add`, `git commit`, `git pull --rebase`, and `git push` may need elevated permissions because git metadata lives under the parent repository's `.git/worktrees/...`
  - If commit hooks modify files during commit or amend, rerun the required verification on the final committed tree before finishing
  - If `gh auth` is stale or broken, prefer the GitHub connector for PR creation or updates instead of blocking on CLI auth
- **ALWAYS use `pnpm` for Node.js work**
  - Use `pnpm` for dependency installation, upgrades, scripts, and workspace commands
  - Do not use `npm` or `yarn` anywhere in this repository
- **ALWAYS use root `just` commands when they exist**
  - Prefer `just` over ad hoc command sequences for build, test, quality, database, and OpenAPI workflows
  - Start command discovery by running `just`, which lists available recipes with their descriptive comments
  - Use `just --list --unsorted` only if you specifically need the unsorted view
- **ALWAYS look for existing patterns before writing code**
  - Check whether the repository already solves the same or a similar problem elsewhere before you implement anything new
  - Match the surrounding structure, naming, validation approach, error handling, and test style when an established pattern exists
  - Only introduce a new pattern when the existing ones do not fit, and make that choice intentionally
- **NEVER start the server directly or as a background process**
  - Do not use `node dist/src/index.js &`, `pnpm start &`, `tsx src/index.ts &`, or similar commands
  - Do not leave background processes running after the agent finishes
  - Only use `just dev-server` if the user explicitly asks you to start the server
  - For API verification, use `just compile-server` and let the user run the server manually
  - If OpenAPI spec download is needed, prefer asking the user to start the server first instead of relying on auto-start behavior
- **NEVER suppress lint or type errors**
  - Do not add `oxlint-disable`, `oxlint-disable-next-line`, `eslint-disable`, `eslint-disable-next-line`, `@ts-ignore`, or `@ts-expect-error`
  - Fix the underlying issue with better types, refactors, validation, or type guards
- **NEVER use TypeScript type assertions or casting**
  - Do not use `as Type` or `<Type>value`
  - If TypeScript cannot infer a type, validate the data instead of forcing the type
- **ALWAYS validate unknown or external data**
  - Use Zod `.parse()` or `.safeParse()` for database rows, request payloads, and external API responses
  - Treat validation gaps as real bugs, not typing inconveniences
- **NEVER hide required dependency failures behind misleading success responses**
  - If an endpoint depends on data such as foreign exchange rates, cached prices, or other derived records to produce the response the app actually relies on, fail with a clear `5xx` and error code when that dependency is missing or unusable
  - Do not silently fall back to placeholder values, alternate currencies, partial payloads, or `null` just to keep a `200` response alive unless that degraded state is explicitly documented and intentionally supported by the contract
  - Prefer surfacing the bug clearly over making the response look superficially valid while violating downstream assumptions
- **ALWAYS use the shared Pino logger for server logging**
  - Use the shared logger entrypoint for `server/src/**` request middleware, handlers, error handling, and startup/shutdown
  - Never introduce `console.*` in `server/src/**`; Oxlint treats it as an error
  - `server/scripts/**` may use `console.*` for local operator feedback
  - Include the standard structured fields when relevant: `service`, `component`, `event`, `mode`, `request_id`, `method`, `path`, `route`, `status_code`, `duration_ms`, `user_id`, `outcome`, `error_code`, and `error_name`
  - Log meaningful successful business outcomes as well as failures
  - Never log secrets, tokens, cookies, email addresses, or raw request/response payload dumps
  - Add or update tests whenever logging behavior changes
- **ALWAYS write tests for behavior changes**
  - Prefer integration tests over isolated unit tests when the behavior crosses handlers, middleware, database, auth, or HTTP boundaries
  - Avoid redundant tests when an existing integration test already covers the scenario
  - For detailed testing workflow and conventions, use `.agents/testing-best-practices/SKILL.md`
- **If app UI tests look flaky, first make sure `Kowalski.app` is not already open**
  - A locally open app can cause macOS UI tests to fail with launch, termination, or accessibility errors
  - If you notice this kind of flakiness, terminate `Kowalski` and rerun the failing UI test or `just test-ui`
- **NEVER manually edit `.xcstrings` files**
  - Add or update `NSLocalizedString` calls in Swift code and let Xcode update the localization catalogs

## Build, Test, and Development Commands

**ALWAYS run commands from the repository root unless the command explicitly requires a package directory.**

- Start by running `just` to discover the current command surface and read each recipe's descriptive comment
- Prefer discovered `just` recipes over memorized command lists, since the available commands can change over time
- Use repo-specific direct package commands only when there is no suitable root `just` recipe
- For Swift package verification, run `swift build` in the affected package directory when needed
- For OpenAPI work, confirm the current spec-related recipe names via `just` before running them

## Coding Style & Naming Conventions

- **Language stack**
  - Server: TypeScript, ESM modules, Node.js 24+, Hono, Drizzle, Zod
  - App: Swift 6.3+, SwiftUI, Observation, Swift Package Manager, Xcode
- **TypeScript**
  - Use `.js` extensions in local imports
  - Keep filenames in `kebab-case`
  - Use `camelCase` for variables and functions
  - Use `PascalCase` for schemas, types, and classes
  - Prefer default exports for routes and handlers where the codebase already follows that pattern
  - Never use deprecated APIs when Oxlint or TypeScript flags a modern replacement
  - Centralize reusable constants in `server/src/constants/`
  - For OpenAPI-backed Hono handlers, type `HonoContext` with validated `out` shapes so `c.req.valid(...)` is strongly typed without casts
  - Avoid N+1 queries in bulk flows; collect related identifiers first and fetch needed records with one set-based query before looping
- **Type safety**
  - Do not cast values to force them through the type system
  - Validate unknown data at boundaries with Zod
  - Use type guards or schema transforms instead of suppression comments
- **Swift**
  - Keep filenames in `PascalCase`
  - Treat warnings as errors
  - Use `@Observable` and `@MainActor` patterns consistently with the existing codebase
  - Prefer `do-catch` with logging over `try?`
  - Use `async/await` with explicit error handling
  - Prefer one condition per `guard` line for readability
  - Prefer enums over repeated raw strings for fixed fields, keys, and identifiers; derive lists like CSV headers from `CaseIterable` enums when possible
- **Localization**
  - Use `NSLocalizedString` with the correct `.module` bundle when localizing Swift packages
  - Do not hardcode user-facing text if the surrounding module already localizes it

## Testing Guidelines

- **Primary command:** `just test`
  - Runs server tests and non-UI Swift client/app tests
- **UI test command:** `just test-ui`
  - Runs `KowalskiUITests`
  - Only run this when a human explicitly requests app UI test coverage
- **Final command:** `just ready`
  - Required for code changes
  - Runs quality checks, downloads the OpenAPI spec, and executes non-UI test coverage
  - Not required for docs-only changes unless the user explicitly asks for it
- **Preferred testing style**
  - Favor integration tests for routes, middleware, auth flows, and database-backed behavior
  - Exercise the full stack where practical: HTTP request, middleware, handler, persistence, and response
  - Add contract coverage for API changes and regression coverage for bug fixes
  - Avoid duplicate coverage when a broader integration test already proves the behavior
- **Current testing surface**
  - Server integration tests exist for auth, stocks, cache-related behavior, and API flows
  - Swift client tests cover authentication and middleware behavior
- **Constitution requirements**
  - Follow `.specify/memory/constitution.md`
  - Test-first development is expected for substantive feature work
  - Critical paths such as auth and persistence require especially strong coverage

## Security & Configuration Tips

- **Required server environment**
  - Create `.env` in the repository root from `.env.example`
  - In linked worktrees, prefer `just setup-worktree-env`, which writes both files with isolated ports and database settings
  - Required values:

```bash
DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:8080
```

- **Optional server environment**
  - `PORT` defaults to `8080`
  - `DEBUG` defaults to `false`
  - `LOG_LEVEL` defaults to `info`
  - `BETTER_AUTH_SESSION_UPDATE_AGE_DAYS` defaults to `1`
  - `BETTER_AUTH_SESSION_EXPIRY_DAYS` defaults to `30`
- **Database service**
  - PostgreSQL runs via Docker Compose
  - Host: `localhost:5432`
  - Database: `kowalski`
  - User: `kowalski_user`
  - Password: `kowalski_password`
- **Prerequisites**
  - Node.js `24+`
  - pnpm `10+`
  - Docker
  - Xcode `16.3+`
  - `just`

## API & OpenAPI Workflow

- **Documentation endpoints**
  - Swagger UI: `http://localhost:8080/doc`
  - JSON spec: `http://localhost:8080/spec.json`
  - YAML spec: `http://localhost:8080/spec.yaml`
- **OpenAPI-first server design**
  - Define routes with `@hono/zod-openapi`
  - Keep request and response schemas in Zod and attach OpenAPI metadata
  - Parse response payloads against the documented schema before returning them when the handler performs non-trivial mapping or aggregation
  - Regenerate the Swift client inputs after schema changes
- **Spec workflow**
  - Update server route schemas first
  - Run `just download-spec` after API changes
  - Rebuild the affected Swift package or client with `swift build`
- **Agent-specific OpenAPI caution**
  - `just download-spec` generates the spec directly from the server app without starting a server
  - Agents should keep spec generation on that in-process path instead of starting the server just to fetch `/spec.yaml`

## Key Architectural Patterns

- **Server**
  - OpenAPI-first route definitions
  - Middleware order includes request IDs, compression, secure headers, logging, and context injection
  - Database and auth clients are injected via middleware/context
  - For bulk database writes, collect rows and perform a single set-based insert or update through the repository layer instead of looping single-row writes from a service when the behavior is the same
  - Errors are normalized through custom exceptions and centralized handlers
- **App**
  - Feature-first Swift packages
  - Shared visual language lives in `KowalskiDesignSystem`
  - API access flows through the generated `KowalskiClient`
  - UI state uses the Observation framework rather than older observable object patterns

## Common Workflows

- **Adding a new API endpoint**
  - Define the route under the appropriate server feature module
  - Add Zod request and response schemas with OpenAPI metadata
  - Wire the route into the feature router
  - Run `just download-spec`
  - Build the affected Swift client or package
- **Adding a new database table**
  - Create or update schema files in `server/src/db/schema/`
  - Export the schema from `server/src/db/index.ts` if needed
  - Run `just compile-server`
  - Run `just make-migrations`
  - Run `just migrate`
- **Adding a new Swift feature**
  - Add or update the relevant package under `app/`
  - Keep warnings at zero
  - Add the product or dependency wiring in `Package.swift` where required
  - Run `swift build` in the affected package
  - Run `just test` and `just ready`
  - Run `just test-ui` only when a human explicitly requests app UI test coverage
