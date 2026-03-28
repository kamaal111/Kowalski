# Swift Testing Best Practices

## Test Naming

Always use backtick function names for tests. The function name is the display name — do not pass a separate string to `@Test`.

```swift
@Test
func `Should add session token to Authorization header for token refresh endpoint`() async throws {
    // ...
}
```

Do **not** use `@Test("description")` with a camelCase function name. Only the backtick style is used in this codebase.

## Grouping with `@Suite`

Use `@Suite("Display Name")` to group related tests under a named suite. Keep the annotation even when the struct name is descriptive — it controls the display name shown in test output.

```swift
@Suite("RefreshTokenMiddleware Tests")
struct RefreshTokenMiddlewareTests {

    @Test
    func `Should add session token to Authorization header for token refresh endpoint`() async throws {
        // ...
    }
}
```

## SwiftLint Enforcement

The `swift_testing_no_labeled_test` custom rule in `app/.swiftlint.yml` errors on `@Test("...")` across all source and test files. Using a string label with `@Test` will fail `just lint-app`.

## Verification

Run tests with:

```sh
just test-app   # Swift app tests only
```
