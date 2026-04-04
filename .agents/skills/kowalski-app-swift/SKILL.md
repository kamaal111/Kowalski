---
name: kowalski-app-swift
description: Repository-specific patterns for Kowalski's Swift app stack built with SwiftUI, Observation, Swift Package Manager, and a generated OpenAPI client. Use when changing files under `app/**`, including feature packages, SwiftUI screens, feature models, OpenAPI client wrappers, design-system components, previews, package manifests, or Swift tests.
---

# Kowalski App Swift

## Overview

Follow this skill to keep app work aligned with the repository's feature-first package structure, Observation-based state, and Swift Testing conventions. Prefer patterns already used in `KowalskiFeatures`, `KowalskiClient`, `KowalskiDesignSystem`, and `KowalskiApp`.

## Start Here

- Read the closest package and feature before changing code. Reuse the surrounding structure instead of introducing a new architecture.
- Work from the repository root unless a Swift package command must run inside a package directory.
- Treat warnings as errors. The package manifests enforce strict settings and the codebase expects clean concurrency-aware Swift.
- Preserve the separation between app shell, feature packages, generated client wrappers, and design-system components.

## Package and Module Shape

- Keep features in Swift packages under `app/`, not in the app target by default.
- Keep public entry points small and place implementation details under `Internals/` when the package already does so.
- Reuse the existing module split:
  - `KowalskiApp` for the scene shell
  - `KowalskiFeatures` for feature state and screens
  - `KowalskiClient` for typed API wrappers over generated OpenAPI operations
  - `KowalskiDesignSystem` for shared UI components
  - `KowalskiUtils` for cross-cutting utilities
- Keep filenames in `PascalCase`.

## State and Dependency Patterns

- Use `@Observable` and `@MainActor` on long-lived feature models that own user-visible state.
- Inject those models through SwiftUI environment helpers such as `.kowalskiAuth(...)` and `.kowalskiPortfolio(...)`.
- Create environment-aware factories such as `default()`, `preview(...)`, `forEnvironment()`, and `testing(...)` when the module already uses them.
- Keep mutable UI state inside the owning feature model or view, not split across redundant wrappers.
- Refresh feature state after successful mutations when the existing feature already follows that pattern.

## View and Feature Patterns

- Keep SwiftUI views focused on rendering and orchestration.
- Pass async closures into reusable editors and supporting views rather than hard-coding one screen's workflow into the shared component.
- Use `@State`, `@FocusState`, and environment objects sparingly and intentionally.
- Reuse `KowalskiDesignSystem` components before introducing a new field or control.
- Provide previews that exercise realistic app states through the existing preview factories.

Model new work after files such as:

- `app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift`
- `app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuth.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/SupportingViews/KowalskiPortfolioTransactionEditor.swift`
- `app/KowalskiClient/Sources/KowalskiClient/KowalskiClient.swift`

## Client and Error-Handling Patterns

- Keep the generated OpenAPI surface behind small protocols and wrapper types in `KowalskiClient`.
- Return `Result<Success, Failure>` from async client and feature APIs when the surrounding module already does so.
- Map transport and API errors into feature-specific error enums instead of leaking raw generated types into the UI.
- Use explicit `switch` or `do/catch` flows for fallible calls that matter.
- Reserve `try?` for intentionally optional parsing or probing, not for meaningful control flow that should be logged or surfaced.
- Log unexpected failures with `KamaalLogger` instead of silently swallowing them.

## Swift Style Rules

- Prefer one condition per `guard` line for readability.
- Prefer explicit async flows over hidden side effects.
- Keep localization consistent with nearby code.
- Use `NSLocalizedString(..., bundle: .module, comment: "")` inside Swift packages that ship their own resources.
- Do not manually edit `.xcstrings` files. Add or update localization calls in Swift and let Xcode manage the catalog.

## Concurrency and Configuration

- Respect the package's strict settings in `Package.swift`, including warnings-as-errors, strict memory safety, and strict concurrency.
- Keep `Sendable` boundaries honest for shared protocols and generic view callbacks when concurrency crosses those boundaries.
- Use actor-based test doubles when concurrent mutation or call counting is involved.

## Testing Patterns

- Use Swift Testing, not XCTest-style conventions, when working in the package tests that already use it.
- Prefer `@Suite` and `@Test` with descriptive backtick names.
- Assert `Result` values through `.get()` and `#require(throws:)` or `#expect(...)` rather than large manual switch statements.
- Build focused mocks and previews that match the package's protocol boundaries.
- Verify user-facing error formatting, refreshed state after mutations, and request construction in client tests when those behaviors change.

## Verification Workflow

- Run `swift build` in the affected package directory when package code changes.
- Run `just test` for app behavior changes unless the work is docs-only.
- Run `just ready` from the repository root before declaring app code changes complete.
- Run `just test-ui` only when a human explicitly asks for UI test coverage.

## Expected Output When Using This Skill

- State which package or feature patterns you followed.
- State which package builds or tests you ran.
- State whether `just ready` passed, or why it was intentionally skipped.
