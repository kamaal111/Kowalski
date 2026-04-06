---
name: kowalski-dependency-upgrade
description: Repository-specific workflow for upgrading Kowalski dependencies across pnpm, Swift Package Manager, generated OpenAPI inputs, and related tooling. Use when auditing outdated packages, upgrading root or `server/` Node dependencies, updating Swift package requirements or resolved versions under `app/`, validating upgrade safety with `just` and `swift build`, diagnosing breaking changes introduced by newer versions, or repairing regressions caused by dependency updates.
---

# Kowalski Dependency Upgrade

## Overview

Use this skill to upgrade dependencies in controlled batches, validate each batch with repo-standard commands, and carry breakage fixes through to a clean `just ready`.

Prefer several small upgrade passes over a repo-wide blind bump. This repository mixes root pnpm tooling, a separate `server/` pnpm project, SwiftPM packages, generated OpenAPI inputs, and Xcode resolution state, so a single dependency change can ripple across TypeScript, Swift, and generated client code.

## Upgrade Surfaces

- Root Node tooling lives in `package.json` and `pnpm-lock.yaml`.
- Server Node dependencies live in `server/package.json` and `server/pnpm-lock.yaml`.
- Swift package requirements live in `app/*/Package.swift`.
- Resolved Swift versions live in `app/*/Package.resolved` and `app/Kowalski.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`.
- API-generated client input lives in `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml`.

For the current package map, read [upgrade-surface.md](./references/upgrade-surface.md).

## Core Rules

- Run `just` first and prefer repo `just` recipes over ad hoc commands.
- Use `pnpm`, never `npm` or `yarn`.
- Do not start the server directly or leave background processes running.
- Do not skip `just ready` for real upgrade work.
- Fix breakages instead of suppressing them with casts, `@ts-ignore`, lint disables, or warning downgrades.
- Upgrade in a way that keeps the repo shippable after each batch when practical.

## Workflow

### 1. Discover and scope

- Read `AGENTS.md`, `justfile`, and the manifests you plan to touch.
- Inventory Node updates separately for the repo root and `server/`.
- Inventory Swift updates from the affected `Package.swift` and `Package.resolved` files.
- Group upgrades into sensible batches:
  - Root tooling
  - Server runtime and dev dependencies
  - Swift OpenAPI stack
  - Shared Swift libraries such as `KamaalSwift` and `ForexKit`
- Call out upgrades that are likely to require code changes before applying them.

### 2. Upgrade deliberately

- Root tooling: update `package.json` and `pnpm-lock.yaml` with `pnpm` from the repo root.
- Server dependencies: update `server/package.json` and `server/pnpm-lock.yaml` from `server/`.
- Swift dependencies: update version requirements in the relevant `app/*/Package.swift`, then refresh resolved packages in the affected package directories or Xcode workspace.
- Keep generated or resolved files in sync when package managers update them.
- If one dependency is especially risky, upgrade it alone first.

### 3. Validate the narrowest surface first

- Root tooling only: run `just lint`, `just format-check`, and `just typecheck` as needed.
- Server-only dependency changes: run `just compile-server` and `just test`.
- Swift-only dependency changes: run `swift build` in each affected package directory, then `just test`.
- Generated client or API-adjacent changes: run `just download-spec` if the contract or generator output changed, then rebuild the affected Swift packages.
- Use `just ready` as the final gate once the targeted fixes are in place.

### 4. Fix breaking changes instead of rolling forward blindly

- Load the repo-specific skills that match the failures:
  - `kowalski-server-typescript` for `server/src/**`
  - `kowalski-app-swift` for `app/**`
  - `testing-best-practices` for regression coverage
  - `kowalski-git-worktree` when working from a linked worktree
- Prefer adapting code to the new public API over pinning versions back down immediately.
- When a generated client upgrade changes Swift compile errors, update call sites, helper wrappers, and tests in the same pass.
- When a server library upgrade changes runtime or schema behavior, update Zod validation, route contracts, and integration tests together.
- If a batch becomes noisy or ambiguous, stop expanding scope and finish one breakage cluster before touching more packages.

### 5. Finish with repo-standard verification

- Run the smallest useful commands while iterating.
- Run `just ready` from the repo root before declaring the upgrade complete.
- If `just ready` fails because of environment or service issues rather than code, say so explicitly and include the exact failing command.
- Do not run `just test-ui` unless a human explicitly asks for UI coverage.

## Common Breakage Patterns in This Repo

- `@hono/*`, `zod`, `drizzle`, or auth upgrades often require route, schema, or handler updates plus integration test fixes.
- OpenAPI generator or runtime upgrades can break `KowalskiClient` generated output or calling code in `KowalskiFeatures`.
- `ForexKit` or `KamaalSwift` upgrades can ripple through `KowalskiClient`, `KowalskiDesignSystem`, and `KowalskiFeatures`.
- Swift upgrades can fail on warnings because packages treat warnings as errors and enable strict concurrency and memory-safety settings.
- Spec or generator changes may require refreshing `app/KowalskiClient/Sources/KowalskiClient/openapi.yaml` and rebuilding dependent Swift packages.

## Expected Output When Using This Skill

Finish by stating:

- which dependency batches were upgraded
- which breakages were fixed
- which commands were run
- whether `just ready` passed or why it did not
