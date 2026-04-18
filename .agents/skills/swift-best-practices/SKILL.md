---
name: swift-best-practices
description: Reusable guidance for Swift, SwiftUI, and Swift Package Manager work. Use when changing Swift files, SwiftUI views, feature models, package manifests, client wrappers, previews, localization calls, concurrency boundaries, or Swift tests.
---

# Swift Best Practices

## Overview

Apply this skill to keep Swift code aligned with the surrounding module structure, state model, concurrency rules, and test conventions. Reuse local patterns before introducing new architecture.

## Start Here

- Read the closest package, feature, or target before editing.
- Work from the repository root unless a package command must run inside a package directory.
- Preserve the existing module split instead of collapsing feature, client, and UI code together.
- Treat warnings as real work. If the package treats warnings as errors, fix them instead of routing around them.

## Structure Modules Deliberately

- Keep public entry points small when the package already hides implementation details behind internal modules or folders.
- Preserve the existing boundary between app shell code, feature state, reusable UI, utilities, and transport or client wrappers.
- Keep filenames in `PascalCase`.
- Reuse the nearest existing package layout before inventing a new one.

## Model State Explicitly

- Use `@Observable` and `@MainActor` on long-lived models that own user-visible state when the surrounding codebase already follows Observation patterns.
- Inject dependencies through the existing environment, initializer, or factory patterns instead of adding parallel dependency plumbing.
- Keep mutable UI state inside the owning model or view.
- Minimize stored state. Combine values with the same lifecycle into one stored property and expose derived values as computed properties.
- Refresh owned state after successful mutations when the existing feature already follows that flow.

## Keep Views Focused

- Keep SwiftUI views focused on rendering and orchestration.
- Pass callbacks or async closures into reusable supporting views instead of hard-coding one screen's workflow into a shared component.
- Use `@State`, `@FocusState`, and environment-driven state intentionally rather than by default.
- Reuse existing design-system components before adding a new control.
- Provide previews that exercise realistic states when the project already uses previews heavily.

## Handle Clients And Errors Cleanly

- Keep generated or transport-heavy clients behind small protocols or wrapper types when the codebase already abstracts them.
- Centralize deployment-sensitive configuration, such as base URLs or shared transport setup, instead of scattering it across call sites.
- Return `Result` from async APIs only when the surrounding module already uses that style; otherwise match the local error-handling pattern.
- Map transport and API errors into feature-specific errors before they reach the UI.
- Prefer `do/catch` or explicit `switch` flows for meaningful failures.
- Reserve `try?` for intentionally optional probing or parsing, not for failures that should be surfaced or logged.

## Preserve Swift Style And Concurrency

- Prefer one condition per `guard` line when it improves readability.
- Prefer explicit async flows over hidden side effects.
- Prefer enums over repeated raw strings for fixed keys, identifiers, or headers.
- Keep `Sendable` boundaries honest instead of forcing conformance through casts or suppressed warnings.
- Use actor-based test doubles when concurrent mutation or call counting is involved.
- Use `NSLocalizedString(..., bundle: .module, comment: "")` inside Swift packages that ship their own resources.
- Update localization calls in Swift rather than editing `.xcstrings` files by hand.

## Test And Verify Thoughtfully

- Load [testing-best-practices](../testing-best-practices/SKILL.md) for broader test workflow decisions.
- Use Swift Testing patterns when the surrounding tests already use them.
- Prefer descriptive `@Suite` and `@Test` coverage over large monolithic tests.
- Assert `Result` values through `.get()` and `#require(throws:)` or `#expect(...)` instead of manual switch pyramids.
- Mock at existing transport or protocol boundaries before adding production-only seams for tests.
- Verify user-facing error formatting, refreshed state, and request construction when those behaviors change.
- Run the narrowest useful build or test commands while iterating, then run the repository's required final verification.

## Expected Output When Using This Skill

Finish by stating:

- which module or feature patterns you followed
- which Swift packages, targets, or files you touched
- which builds or tests you ran
- whether the repository's final verification passed, or why it was skipped
