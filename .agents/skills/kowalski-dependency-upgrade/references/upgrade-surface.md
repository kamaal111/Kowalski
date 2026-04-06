# Upgrade Surface

## Node Projects

This repository has two separate pnpm-managed dependency surfaces:

- Repo root:
  - `package.json`
  - `pnpm-lock.yaml`
  - Tooling includes `oxlint`, `oxfmt`, `prettier`, `typescript`, `husky`, and `lint-staged`
- Server package:
  - `server/package.json`
  - `server/pnpm-lock.yaml`
  - Runtime libraries include `hono`, `@hono/*`, `better-auth`, `drizzle-orm`, `pino`, `zod`, and `yahoo-finance2`
  - Build and test tooling includes `tsx`, `typescript`, `vitest`, `drizzle-kit`, and `tsc-alias`

Useful commands:

- `pnpm outdated`
- `pnpm up <pkg>`
- `pnpm up <pkg>@latest`
- `pnpm --dir server outdated`
- `pnpm --dir server up <pkg>`
- `pnpm --dir server up <pkg>@latest`

Treat the root and `server/` as separate upgrade passes. Keep both lockfiles in sync with their corresponding manifest changes.

## Swift Packages

Swift package manifests live at:

- `app/KowalskiApp/Package.swift`
- `app/KowalskiFeatures/Package.swift`
- `app/KowalskiDesignSystem/Package.swift`
- `app/KowalskiUtils/Package.swift`
- `app/KowalskiClient/Package.swift`

Resolved package state currently appears in:

- `app/KowalskiApp/Package.resolved`
- `app/KowalskiFeatures/Package.resolved`
- `app/KowalskiDesignSystem/Package.resolved`
- `app/KowalskiClient/Package.resolved`
- `app/Kowalski.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`

Useful commands:

- `swift package update`
- `swift build`

Run Swift commands from the affected package directory. If workspace-level resolution also changes, keep the Xcode workspace `Package.resolved` file aligned with the package-level updates.

## Validation Order

Use the narrowest verification that matches the upgrade:

1. Root tooling:
   - `just lint`
   - `just format-check`
   - `just typecheck`
2. Server dependency changes:
   - `just compile-server`
   - `just test`
3. Swift dependency changes:
   - `swift build` in each affected package directory
   - `just test`
4. Final gate:
   - `just ready`

Only run `just test-ui` when a human explicitly asks for UI coverage.

## High-Risk Upgrade Zones

- `better-auth`, `drizzle-orm`, and `zod` upgrades can force server contract or validation changes.
- `@hono/zod-openapi` and related OpenAPI tooling can affect route definitions and generated Swift client output.
- `swift-openapi-*` upgrades can break `KowalskiClient` generation and downstream package compilation.
- Shared Swift libraries that appear across multiple package manifests can fan out across `KowalskiClient`, `KowalskiDesignSystem`, and `KowalskiFeatures`.
