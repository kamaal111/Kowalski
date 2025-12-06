# Agent Guidelines for Kowalski

**Monorepo**: TypeScript/Node.js server + SwiftUI iOS/macOS app

## Technology Stack

### Backend (server/)

- **Framework**: Hono (web framework)
- **Runtime**: Node.js
- **Database**: PostgreSQL (via Drizzle ORM)
- **Auth**: Better Auth
- **Validation**: Zod with OpenAPI support
- **API Docs**: OpenAPI with Swagger UI
- **Testing**: Vitest

### Frontend (app/)

- **Framework**: SwiftUI with Observation
- **Platforms**: iOS 17+, macOS 14+
- **API Client**: OpenAPI Generator (auto-generated from server spec)
- **Dependencies**:
  - KamaalSwift (utilities, UI, logger, extensions)
  - ForexKit (currency/forex handling)
  - SwiftValidator (validation)

### Infrastructure

- **Database**: PostgreSQL 17 (Docker container `kowalski-db`)
- **Container**: Docker Compose for local development
- **CI/CD**: Husky for git hooks, lint-staged for pre-commit

## Build & Run Commands

### Server (TypeScript)

- **Bootstrap**: `just bootstrap` (installs NVM, Node 24, corepack, dependencies)
- **Dev**: `just dev-server` (starts Docker + server with hot reload on port 8080)
- **Run**: `just run-server` (compile + start production server)
- **Compile**: `just compile-server` (TypeScript compilation to `dist/`)
- **Test**: `just test` (vitest run mode). Single test: `cd server && pnpm test -- <filename>`
- **Lint**: `just lint` (ESLint with recommended + strict + stylistic rules)
- **Format**: `just format` (Prettier) or `just format-check`
- **Typecheck**: `just typecheck` (TypeScript with `--noEmit`)
- **Quality**: `just quality` (lint + format-check + typecheck)

### Database (PostgreSQL)

- **Start**: `just start-services` (Docker Compose up -d)
- **Stop**: `just stop-services` (Docker Compose down)
- **Logs**: `just tail-db` (follow database logs)
- **Migrate**: `just migrate` (run pending migrations)
- **Make Migrations**: `just make-migrations` (generate new migration)
- **Pull Schema**: `just pull-schema` (pull from remote DB)
- **Push Schema**: `just push-schema` (push to remote DB)
- **Auth Tables**: `just make-auth-tables` (generate Better Auth schema)

### iOS/macOS App (Swift)

- **Build**: Open `app/Kowalski.xcodeproj` in Xcode (Cmd+B)
  - For individual packages: `cd app/<PackageName> && swift build`
  - **IMPORTANT**: Always verify package builds after modifications using `swift build`
- **Run**: Xcode Run (Cmd+R) or iOS Simulator
- **Test**: Xcode Test (Cmd+U) or `swift test` in package directories
- **Swift version**: 6.2+, Platforms: macOS 14+, iOS 17+

### API & OpenAPI

- **Download Spec**: `just download-spec` (auto-starts server if needed, saves to `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml`)
- **API Docs**: http://localhost:8080/doc (Swagger UI, requires running server)
- **OpenAPI Spec**: http://localhost:8080/spec.json (requires running server)

## Environment Setup

### Required Environment Variables (server/)

Create `server/.env` from `server/.env.example`:

```bash
DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
BETTER_AUTH_SECRET=<generate with: openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:8080
```

**Optional**:

- `PORT` (default: 8080)
- `DEBUG` (default: false, set to "true" for verbose logging)
- `BETTER_AUTH_SESSION_UPDATE_AGE_DAYS` (default: 1)
- `BETTER_AUTH_SESSION_EXPIRY_DAYS` (default: 30)

### Database Connection

Docker Compose creates `kowalski_db` container:

- **Host**: localhost:5432
- **Database**: kowalski
- **User**: kowalski_user
- **Password**: kowalski_password

## Code Style

### Quality Assurance

**CRITICAL**: Always run `just quality` before marking any TypeScript/JavaScript changes as complete. This runs:

- `pnpm run lint` (ESLint with strict rules)
- `pnpm run format:check` (Prettier formatting)
- `just server/typecheck` (TypeScript type checking)

If any issues occur, fix them and re-run `just quality` until all checks pass. **Do not claim a task is done without passing quality checks.**

### TypeScript (server/)

- **Strict mode**: `verbatimModuleSyntax` enabled, all ESLint rules enforced
- **Imports**: Use `.js` extensions for local imports (`from './file.js'`)
- **Module**: ESM only (`type: "module"`)
- **Files**: kebab-case (e.g., `sign-in.ts`)
- **Types/Schemas**: PascalCase, use `.openapi()` for Zod schemas
- **Functions/vars**: camelCase
- **Errors**: Custom exception classes extending `APIException` (see `server/src/auth/exceptions.ts`)
- **Constants**: Centralize in `src/constants/` (HTTP codes, MIME types)
- **Exports**: Default exports for routes/handlers
- **Formatting**: Prettier with `@kamaalio/prettier-config`
- **ESLint**: Recommended + TypeChecked + Strict + Stylistic configs
- **Deprecated APIs**: Never use deprecated APIs (ESLint flags them with `@typescript-eslint/no-deprecated`). Use modern alternatives.

### Swift (app/)

- **Files**: PascalCase (e.g., `KowalskiAuth.swift`)
- **Warnings as errors**: All Swift packages use `.treatAllWarnings(as: .error)` - zero tolerance
- **Architecture**: SwiftUI + Observation framework (`@Observable`, `@MainActor`)
- **Errors**: Custom enums with `errorDescription`, use `Result<T, E>` when error details matter
- **Error handling**: Prefer `do-catch` with logging over `try?` to avoid silently swallowing errors
- **Async**: Use `async/await` with proper error handling
- **Guard statements**: Each condition on its own line for readability (prefer separate guards over comma-separated conditions)
- **Localization**: `.xcstrings` files, use `NSLocalizedString` with `.module` bundle
  - **IMPORTANT**: Never manually edit `.xcstrings` files. Xcode automatically updates them when it detects new `NSLocalizedString` calls in the code.

## Package Managers

- **TypeScript**: pnpm 10.22.0+ (managed via corepack), Node 24+ (via NVM)
- **Swift**: Swift Package Manager (SPM)
- **Workspace**: pnpm workspace (root + server/)

## Git Workflow

- **Pre-commit Hook**: Husky runs `lint-staged`
  - Auto-fixes ESLint issues on `**/*.{js,ts,tsx}`
  - Auto-formats all files with Prettier
- **Branch Protection**: Constitution requires feature branches `###-feature-name`
- **SpecKit Integration**: `.specify/` directory contains templates and scripts for feature development

## Key Architectural Patterns

### Server

- **OpenAPI-First**: All routes defined with `@hono/zod-openapi`
- **Middleware Stack**: requestId → compress → secureHeaders → logging → context injection
- **Context Injection**: Database and auth clients injected via middleware
- **Error Handling**: Custom exceptions (InvalidValidation, APIException) with proper HTTP status codes
- **Database**: Drizzle ORM with schema-first approach, migrations in `server/drizzle/`

### App

- **Package-First**: Each feature is a standalone SPM package (KowalskiAuth, KowalskiPortfolio)
- **Design System**: Centralized in KowalskiDesignSystem (colors, typography, components)
- **API Client**: Auto-generated from OpenAPI spec using Swift OpenAPI Generator
- **State Management**: Observation framework (`@Observable`) with `@MainActor` for UI updates

## Testing Strategy

**Current Status**: No tests written (vitest configured but unused)

**Constitution Requirements** (see `.specify/memory/constitution.md`):

- Test-first development (TDD) mandatory: write tests → fail → implement → pass
- > 80% coverage for business logic, 100% for critical paths (auth, data persistence)
- Contract tests for API endpoints
- Integration tests for DB operations, cross-service communication
- Unit tests for business logic, utilities

## Common Tasks

### Adding a New API Endpoint

1. Define route in `server/src/app-api/` or `server/src/auth/routes/`
2. Create Zod schema with `.openapi()` for request/response
3. Export via `openAPIRouterFactory()` with proper OpenAPI metadata
4. Run `just download-spec` to update client OpenAPI spec
5. Rebuild Swift client: `cd app/KowalskiClient && swift build`

### Adding a New Database Table

1. Create schema in `server/src/db/schema/` (import from `drizzle-orm/pg-core`)
2. Export from `server/src/db/index.ts`
3. Run `just compile-server` (required for drizzle-kit)
4. Run `just make-migrations` to generate migration
5. Run `just migrate` to apply migration

### Adding a New Swift Feature

1. Create feature package in `app/` (or add to `KowalskiFeatures`)
2. Add `.treatAllWarnings(as: .error)` to `swiftSettings`
3. Export product in `Package.swift`
4. Import in dependent packages (e.g., `KowalskiApp`)
5. Verify build: `cd app/<PackageName> && swift build`

## Troubleshooting

### Server won't start

- Check `server/.env` exists and has `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`
- Ensure database is running: `just start-services`
- Check port 8080 not in use: `lsof -i:8080`

### Swift package build fails

- Run `swift build` in package directory to see detailed errors
- Verify all warnings resolved (warnings = errors in this project)
- Check dependencies in `Package.swift` are accessible

### Database connection fails

- Verify Docker container running: `docker ps | grep kowalski-db`
- Check health: `docker compose ps`
- View logs: `just tail-db`

### Migration issues

- Always compile first: `just compile-server`
- Check `server/drizzle/` for migration files
- Manually inspect migration SQL before applying

## VSCode Configuration

See `.vscode/settings.json`:

- SpecKit prompts enabled (constitution, specify, plan, tasks, implement)
- Auto-approve terminal commands in `.specify/scripts/`
- Custom dictionary: "Kowalski"
