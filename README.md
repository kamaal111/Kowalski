# Kowalski

Kowalski is a monorepo project consisting of a TypeScript/Node.js backend server and a SwiftUI iOS/macOS application.

## 🏗 Tech Stack

### Backend (`server/`)

- **Framework**: [Hono](https://hono.dev/)
- **Runtime**: Node.js (v26)
- **Database**: PostgreSQL (via [Drizzle ORM](https://orm.drizzle.team/))
- **Auth**: [Better Auth](https://www.better-auth.com/)
- **Validation**: Zod with OpenAPI support
- **Testing**: Vitest

### Frontend (`app/`)

- **Framework**: SwiftUI
- **Platforms**: iOS 17+, macOS 14+
- **API Client**: OpenAPI Generator
- **Architecture**: Feature-based SPM packages

### Infrastructure

- **Containerization**: Docker Compose with PostgreSQL 18
- **Task Runner**: [Just](https://github.com/casey/just)
- **Package Manager**: pnpm

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v26+ (managed via `nvm` recommended)
- **pnpm**: v11+
- **Docker**: For running the database
- **Xcode**: 26.6+ (for Swift 6.2.4 iOS/macOS app development)
- **Just**: Command runner (`brew install just`)

### Installation

1. **Bootstrap the project**
   Installs dependencies and sets up the environment.

   ```bash
   just bootstrap
   ```

2. **Environment Setup**
   Create a `.env` file in the repository root based on `.env.example`.

   ```bash
   cp .env.example .env
   ```

   Ensure the following variables are set:

   ```env
   DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
   BETTER_AUTH_SECRET=<generate-random-string>
   BETTER_AUTH_URL=http://localhost:8082
   ```

   In a linked worktree, prefer:

   ```bash
   just setup-worktree-env
   ```

   That generates isolated root and `server/` env files plus a non-`5432` database port so agents do not collide with local development services.

   To create a new Herdr worktree from `origin/main` with isolated database,
   server, and daily API ports, run this from a checkout with a configured root
   `.env`:

   ```bash
   just herdr-worktree feature/my-change
   ```

   The recipe preserves unrelated root env settings and reports the new checkout
   path and ports. Its devcontainer publishes those same API ports to the host.

3. **Start Services**
   Start the PostgreSQL database container. Local development and CI both use
   `docker-compose.yml` as the PostgreSQL runtime definition.

   ```bash
   just start-services
   ```

4. **Run the Server**
   Start the development server with hot-reload.

   ```bash
   just dev-server
   ```

   The server will be available at `http://localhost:8082`.
   - API Docs: `http://localhost:8082/doc`
   - OpenAPI Spec: `http://localhost:8082/spec.json`

5. **Run the App**
   Open `app/Kowalski.xcodeproj` in Xcode and run the scheme `Kowalski`.

### Devcontainer Docker Access

The devcontainer runs development tasks as `node`. The Docker outside-of-Docker
feature mounts the host socket at `/var/run/docker-host.sock` and manages access
through `/var/run/docker.sock`. Let the feature manage these paths; an additional
bind mount at `/var/run/docker.sock` interferes with non-root access.

After updating the devcontainer configuration, use your editor's **Rebuild
Container** command to recreate the container while preserving database volumes.
In a fresh container terminal, verify Docker access:

```bash
whoami # should print node
docker info
just start-services
just start-services
just migrate
```

Both service starts should print `Using PostgreSQL managed by the devcontainer`
and succeed without invoking Docker. The devcontainer starts PostgreSQL and
waits for it to become healthy; backend commands connect to `db:5432`. Rebuilding
applies the `KOWALSKI_DEVCONTAINER=true` environment marker that enables this
behavior. Then run `just dev-server` or `just dev-daily`.

On the host, `just start-services` starts PostgreSQL through Compose as usual.
Run `just stop-services`, `just clean-db`, and `just tail-db` from the host
terminal. `just clean-db` deletes the database volume.

## 🛠 Common Commands

We use `just` to manage project tasks.

| Command                        | Description                                        |
| ------------------------------ | -------------------------------------------------- |
| `just dev-server`              | Start DB and run server in dev mode                |
| `just setup-worktree-env`      | Generate isolated env files for a linked worktree  |
| `just herdr-worktree <branch>` | Create a Herdr worktree with isolated ports        |
| `just start-services`          | Start Docker containers (DB)                       |
| `just stop-services`           | Stop Docker containers                             |
| `just migrate`                 | Run pending database migrations                    |
| `just make-migrations`         | Generate new migrations from schema changes        |
| `just download-spec`           | Generate OpenAPI spec and update Swift client      |
| `just test`                    | Run server and client tests                        |
| `just quality`                 | Run linting, formatting, and type checking         |
| `just ready`                   | Run all checks before committing (quality + tests) |

If login fails because Better Auth cannot decrypt its JWT signing key, run
`just diagnose-auth-keys` on the affected machine using the same environment as
the server. This reads key metadata and checks decryption without changing data
or printing secrets or private keys. A decryption failure does not by itself
prove that the configured secret changed.

If the active key cannot be recovered, `just repair-auth-keys` explicitly retires
unreadable signing keys. It preserves users, sessions, and key records, including
their public keys. Retry login afterward so Better Auth creates a replacement.
Old public keys remain published for Better Auth's default 30-day grace period,
which exceeds this app's default 7-day JWT lifetime. Recovery aborts without
changes if a public key is invalid or a key changes during the operation. Run
inspection first to check that the command targets the intended database.

## 📂 Project Structure

```
.
├── app/                    # iOS/macOS SwiftUI Application
│   ├── Kowalski/           # App target entry point (Assets, Info.plist, entitlements)
│   ├── Kowalski.xcodeproj/ # Xcode project
│   ├── KowalskiApp/        # App composition package (SPM)
│   ├── KowalskiClient/     # Generated OpenAPI API Client (SPM)
│   ├── KowalskiDesignSystem/ # Design-system components (SPM)
│   ├── KowalskiFeatures/   # Feature modules (SPM)
│   ├── KowalskiModels/     # Shared model types (SPM)
│   ├── KowalskiUtils/      # Shared utilities (SPM)
│   └── KowalskiUITests/    # App UI test target
├── server/                 # Node.js Hono Server
│   ├── src/                # Source code
│   ├── drizzle/            # DB Migrations
│   └── scripts/            # Utility scripts
├── justfile                # Task definitions
└── docker-compose.yml      # Infrastructure definition
```

## 📝 Development Workflow

1. **Database Changes**:
   - Modify schema in `server/src/db/schema/`.
   - Run `just make-migrations`.
   - Run `just migrate`.

2. **API Changes**:
   - Update route definitions in `server/src/`.
   - Run `just download-spec` to generate the updated Swift client spec.
   - Rebuild the iOS app.

3. **Code Quality**:
   - Always run `just ready` before pushing changes.
   - The project enforces strict linting and type checking.

## Localization validation

`just ready-app`, `just ready-app-ci`, `just ready`, and app CI verify macOS
localization coverage after app tests compile the current sources with
`SWIFT_EMIT_LOC_STRINGS=YES`. For a standalone check, run `just test-app` first,
then `just check-localizations macos`. `just quality` keeps its existing checks
and does not compile the app or validate catalogs.

The checker compares the compiler's `.stringsdata` output with each source
module's committed `.xcstrings` catalog. Missing extraction, catalogs, or keys
fail with the affected path. Every extracted translatable key must have a
completed translation in each non-source language declared across app catalogs,
including plural and substitution variants. Source-language fallback is valid,
and entries marked `shouldTranslate: false` are exempt from translation checks.
The checker cannot identify arbitrary runtime strings that should be localized
or verify the lookup bundle.

Manage catalogs through Xcode's String Catalog editor or `xcrun xcstringstool
sync`, using the matching module's compiler-generated `.stringsdata` files.
Do not manually edit `.xcstrings` files. Validation itself never changes catalogs.
Run `just test-localization-check` for isolated checker regression tests; these
use Node.js and run without Xcode. No iOS builds or checks are included.
