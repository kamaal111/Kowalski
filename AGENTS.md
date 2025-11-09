# Agent Guidelines for Kowalski

**Monorepo**: TypeScript/Node.js server + SwiftUI iOS/macOS app

## Build & Run Commands

### Server (TypeScript)

- **Dev**: `just dev-server` (starts Docker + server with hot reload)
- **Test**: `just test` (vitest). Single test: `cd server && pnpm test -- <filename>`
- **Lint**: `just lint` (ESLint)
- **Format**: `just format` (Prettier) or `just format-check`
- **Typecheck**: `just typecheck`
- **Quality**: `just quality` (lint + format-check + typecheck)

### iOS/macOS App (Swift)

- **Build**: Open `app/Kowalski.xcodeproj` in Xcode (Cmd+B)
  - For individual packages: `cd app/<PackageName> && swift build`
  - **IMPORTANT**: Always verify package builds after modifications using `swift build`
- **Run**: Xcode Run (Cmd+R) or iOS Simulator
- **Swift version**: 6.2+, Platforms: macOS 14+, iOS 17+

## Code Style

### TypeScript (server/)

- **Strict mode**: `verbatimModuleSyntax` enabled
- **Imports**: Use `.js` extensions for local imports (`from './file.js'`)
- **Module**: ESM only (`type: "module"`)
- **Files**: kebab-case (e.g., `sign-in.ts`)
- **Types/Schemas**: PascalCase, use `.openapi()` for Zod schemas
- **Functions/vars**: camelCase
- **Errors**: Custom exception classes extending `APIException` (see `server/src/auth/exceptions.ts`)
- **Constants**: Centralize in `src/constants/` (HTTP codes, MIME types)
- **Exports**: Default exports for routes/handlers

### Swift (app/)

- **Files**: PascalCase (e.g., `KowalskiAuth.swift`)
- **Warnings as errors**: All Swift packages use `.treatAllWarnings(as: .error)`
- **Architecture**: SwiftUI + Observation framework (`@Observable`, `@MainActor`)
- **Errors**: Custom enums with `errorDescription`, use `Result<T, E>` for async operations
- **Async**: Use `async/await` with proper error handling
- **Localization**: `.xcstrings` files, use `NSLocalizedString` with `.module` bundle
  - **IMPORTANT**: Never manually edit `.xcstrings` files. Xcode automatically updates them when it detects new `NSLocalizedString` calls in the code.

## Package Managers

- **TypeScript**: pnpm 10.20.0+, Node 24+
- **Swift**: Swift Package Manager (SPM)
