---
name: kowalski-app-swift
description: Repository-specific overlay for Kowalski's Swift app stack built with SwiftUI, Observation, Swift Package Manager, and a generated OpenAPI client. Use with `swift-best-practices` when changing files under `app/**`, including feature packages, SwiftUI screens, feature models, OpenAPI client wrappers, design-system components, previews, package manifests, or Swift tests.
---

# Kowalski App Swift

## Overview

Load [swift-best-practices](../swift-best-practices/SKILL.md) first. Use this skill for Kowalski's package layout, helper names, concrete example files, and repo-specific verification details.

## Follow Kowalski's Package Shape

- Read the closest package and feature before editing.
- Keep features in Swift packages under `app/`, not in the app target by default.
- Preserve the existing split between:
  - `KowalskiApp` for the scene shell
  - `KowalskiFeatures` for feature state and screens
  - `KowalskiClient` for typed wrappers over generated OpenAPI operations
  - `KowalskiDesignSystem` for shared UI components
  - `KowalskiUtils` for cross-cutting utilities
- Treat warnings as errors. The package manifests enforce strict concurrency-aware settings.

## Reuse Kowalski-Specific Patterns

- Inject long-lived feature models through helpers such as `.kowalskiAuth(...)` and `.kowalskiPortfolio(...)`.
- Reuse environment-aware factories such as `default()`, `preview(...)`, `forEnvironment()`, and `testing(...)` when the module already provides them.
- Keep the generated OpenAPI surface behind wrappers in `KowalskiClient`.
- Prefer `KowalskiServerConfiguration` for deployment-sensitive setup, especially for clients such as `ForexKit`.
- Log unexpected failures with `KamaalLogger`.

## Model New Work After Existing Files

- `app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift`
- `app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuth.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/KowalskiPortfolio.swift`
- `app/KowalskiFeatures/Sources/KowalskiPortfolio/Internals/Views/SupportingViews/KowalskiPortfolioTransactionEditor.swift`
- `app/KowalskiClient/Sources/KowalskiClient/KowalskiClient.swift`

## Keep Kowalski Tests Honest

- Use the production `fetchLatestExchangeRates` path for `ForexKit`.
- Inject test sessions through `KowalskiServerConfiguration.defaultForexKitConfiguration(...)` instead of adding a parallel seam.

## Verify In Kowalski's Workflow

- Run `swift build` in the affected package directory when package code changes.
- Run `just test` for app behavior changes unless the work is docs-only.
- Run `just ready` from the repository root before declaring app code changes complete.
- Run `just test-ui` only when a human explicitly asks for UI coverage.

## Expected Output When Using This Skill

Finish by stating:

- which Kowalski packages or feature patterns you followed
- which package builds or tests you ran
- whether `just ready` passed, or why it was intentionally skipped
