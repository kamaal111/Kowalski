# Preferences Pane Refresh Plan

## Problem

The current macOS settings pane is visually sparse and interaction-heavy: `KowalskiScene` mounts a single `KowalskiAuthSettingsView`, and that view is currently just a `Form` with one currency picker plus a manual save button. The desired UX is closer to native app settings: a tab bar at the top, settings presented as left-label/right-control rows below it, and immediate persistence when a setting changes. Because saving preferences makes a network request, the pane should lock while the request is in flight.

## Current State

- `app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift` defines the app `Settings { ... }` scene and injects the shared `KowalskiAuth` model.
- `app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuthSettingsView.swift` owns local `selectedCurrency`, `isSaving`, and toast state, renders a `Form`, and requires a manual save button.
- `app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuth.swift` already exposes the persistence hook: `updatePreferredCurrency(_:)` calls the API, updates the in-memory session, and refreshes the cached session used by `effectiveCurrency`.
- There is no existing reusable settings-shell or settings-row component in the app packages today, so this change will likely establish the first one in the auth/settings feature area unless nearby design-system components prove reusable enough during implementation.
- Existing auth tests cover mapping and lower-level client behavior, but there is no direct coverage for the settings-pane save flow or autosave/loading UX.

## Proposed Approach

1. Replace the basic `Form`-plus-button layout with a dedicated settings-pane container that looks like a native settings window:
   - top tab strip with a single `General` tab for this pass,
   - structured content area below,
   - row-based layout with a label on the left and control on the right.
2. Convert the preferred-currency control from staged local editing into immediate-save behavior:
   - when the user changes the picker value, trigger the async preference update immediately,
   - disable the settings content while the request is running,
   - keep the UI synchronized with the confirmed `auth.effectiveCurrency`,
   - surface failures with the existing toast pattern instead of a manual confirmation step.
3. Add targeted tests around the persistence and loading-state orchestration so the autosave flow is covered without depending on full UI automation.

## Likely Files

- `app/KowalskiApp/Sources/KowalskiApp/KowalskiScene.swift`
- `app/KowalskiFeatures/Sources/KowalskiAuth/KowalskiAuthSettingsView.swift`
- Potential new supporting view/state files under `app/KowalskiFeatures/Sources/KowalskiAuth/`
- `app/KowalskiFeatures/Tests/KowalskiAuthTests/`

## Todo Outline

1. Inspect the current settings scene and decide whether the pane should remain auth-owned or gain small supporting views/state types for a cleaner settings-shell layout.
2. Redesign the pane structure to use a top tab bar and aligned settings rows instead of a plain centered form.
3. Replace manual save with autosave-on-change, including disabling the full pane while the request is active and keeping local selection in sync with persisted auth state.
4. Add regression coverage for autosave state transitions and preference persistence behavior.
5. Verify the eventual implementation with the required Swift/package and repo-wide commands.

## Notes / Decisions

- The first version should ship with one real top tab, `General`, and keep the structure ready for future settings categories.
- Autosave success messaging may need to be quieter than the current explicit-save toast flow to avoid noisy feedback on every change; failure feedback should remain explicit.
