# Auth preferences table + migration squash

## Problem

`server/src/db/schema/better-auth.ts` currently contains an app-owned `preferredCurrency` column on the generated Better Auth `user` table. That column is fragile because regenerating or upgrading Better Auth can remove it. The auth session and preferences code already loads the value separately, so the safer design is to move user preferences into an app-owned table and then squash the Drizzle migration history into one baseline while the project is still early-stage.

## Proposed approach

1. Introduce an app-owned preferences table.
   - Add `server/src/db/schema/preferences.ts` with a one-row-per-user table, likely `user_preferences`, keyed by `user_id` with a cascade foreign key to `user.id`.
   - Store `preferred_currency` there now, while leaving room for additional preference columns later.
   - Follow existing schema conventions by reusing shared helpers such as `auditFields` where they fit.

2. Remove app-owned preference state from the generated Better Auth schema.
   - Restore `server/src/db/schema/better-auth.ts` to the canonical Better Auth shape without `preferredCurrency`.
   - Keep Better Auth as the owner of auth tables only, and keep app-owned persistence in app-owned schema files.

3. Rewire auth reads and writes to the new table without changing the API contract.
   - Update `server/src/auth/middleware.ts` so session and JWT-based lookups read `preferred_currency` from the new preferences table and still return `null` when no preference row exists.
   - Update `server/src/auth/handlers/preferences.ts` to upsert the user’s preference into the new table instead of updating the Better Auth `user` row.
   - Preserve the existing request/response schemas and route surface so the app and generated client contract stay unchanged.

4. Cover the persistence move with integration tests.
   - Update `server/src/auth/tests/preferences.integration.test.ts` to seed and assert against the new table instead of `schema.user.preferredCurrency`.
   - Keep coverage for bearer-token session lookup, cookie-based session lookup, successful updates, validation failures, normalization, and the logging expectation already in place.

5. Create a migration that moves data, then squash the history.
   - Add a schema migration that creates the new preferences table, copies any existing `user.preferred_currency` values into it, and then drops `preferred_currency` from `user`.
   - After the schema is correct, squash `server/drizzle/` down to one `0000_*.sql` baseline and one `server/drizzle/meta/0000_snapshot.json` that reflect the final schema, including the new preferences table and excluding `user.preferred_currency`.
   - Rewrite the local `drizzle.__drizzle_migrations` table to match the new baseline hash so the existing development database remains aligned with the squashed files.

## Planned work items

- Add the app-owned preferences schema and export it from `server/src/db/schema/index.ts`.
- Remove `preferredCurrency` from the Better Auth-generated schema file.
- Update auth middleware and the preferences handler to read/write the new table.
- Update auth integration tests to use the new persistence model.
- Generate the migration for the move, then squash all Drizzle migrations and metadata to one baseline.
- Verify with the existing repository commands, ending with `just ready` once implementation starts.

## Notes and decisions

- The external API should remain unchanged: `preferred_currency` stays on the auth session response and on `PATCH /auth/preferences`.
- A missing preferences row should continue to behave like “no preference set” and return `null`.
- The migration squash must fold the entire current schema into the new baseline, not only the preferences change; today’s later migrations also include stock ticker columns and the current `preferred_currency` addition.
- Preferred implementation order: complete the schema/code/test move first, then squash the migration history once the final schema is stable.
- Confirmed: preserve existing `user.preferred_currency` values by backfilling them into the new preferences table during the migration before removing the Better Auth-owned column.
