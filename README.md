# Kowalski

Kowalski is a monorepo project consisting of a TypeScript/Node.js backend server and a SwiftUI iOS/macOS application.

## 🏗 Tech Stack

### Backend (`server/`)

- **Framework**: [Hono](https://hono.dev/)
- **Runtime**: Node.js (v24)
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

- **Containerization**: Docker Compose
- **Task Runner**: [Just](https://github.com/casey/just)
- **Package Manager**: pnpm

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v24 (managed via `nvm` recommended)
- **pnpm**: v10+
- **Docker**: For running the database
- **Xcode**: 16.3+ (for Swift 6.3 iOS/macOS app development)
- **Just**: Command runner (`brew install just`)

### Installation

1. **Bootstrap the project**
   Installs dependencies and sets up the environment.

   ```bash
   just bootstrap
   ```

2. **Environment Setup**
   Create a `.env` file in the `server/` directory based on `.env.example`.

   ```bash
   cp server/.env.example server/.env
   ```

   Ensure the following variables are set:

   ```env
   DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
   BETTER_AUTH_SECRET=<generate-random-string>
   BETTER_AUTH_URL=http://localhost:8080
   ```

3. **Start Services**
   Start the PostgreSQL database container.

   ```bash
   just start-services
   ```

4. **Run the Server**
   Start the development server with hot-reload.

   ```bash
   just dev-server
   ```

   The server will be available at `http://localhost:8080`.
   - API Docs: `http://localhost:8080/doc`
   - OpenAPI Spec: `http://localhost:8080/spec.json`

5. **Run the App**
   Open `app/Kowalski.xcodeproj` in Xcode and run the scheme `Kowalski`.

## 🛠 Common Commands

We use `just` to manage project tasks.

| Command                | Description                                        |
| ---------------------- | -------------------------------------------------- |
| `just dev-server`      | Start DB and run server in dev mode                |
| `just start-services`  | Start Docker containers (DB)                       |
| `just stop-services`   | Stop Docker containers                             |
| `just migrate`         | Run pending database migrations                    |
| `just make-migrations` | Generate new migrations from schema changes        |
| `just download-spec`   | Download OpenAPI spec and update Swift client      |
| `just test`            | Run server and client tests                        |
| `just quality`         | Run linting, formatting, and type checking         |
| `just ready`           | Run all checks before committing (quality + tests) |

## 📂 Project Structure

```
.
├── app/                 # iOS/macOS SwiftUI Application
│   ├── Kowalski/        # Main App Entry
│   ├── KowalskiClient/  # Generated API Client
│   └── KowalskiFeatures/# Feature Modules
├── server/              # Node.js Hono Server
│   ├── src/             # Source code
│   ├── drizzle/         # DB Migrations
│   └── scripts/         # Utility scripts
├── justfile             # Task definitions
└── docker-compose.yml   # Infrastructure definition
```

## 📝 Development Workflow

1. **Database Changes**:
   - Modify schema in `server/src/db/schema/`.
   - Run `just make-migrations`.
   - Run `just migrate`.

2. **API Changes**:
   - Update route definitions in `server/src/`.
   - Run `just download-spec` to update the Swift client.
   - Rebuild the iOS app.

3. **Code Quality**:
   - Always run `just ready` before pushing changes.
   - The project enforces strict linting and type checking.
