---
name: drizzle-migration-squash
description: Squash multiple early Drizzle migrations into one baseline migration in this repository. Use when the project is still in heavy development and you want one clean migration while preserving the current local schema state and Drizzle bookkeeping.
---

# Drizzle Migration Squash

## Use This Skill When

- The repo is still early enough that rewriting migration history is acceptable.
- `server/drizzle/` has several small migrations that should become one baseline migration.
- You want to preserve the current local database schema instead of dropping the whole dev DB.

## Goal

Collapse the current Drizzle migration chain into a single `0000_*.sql` baseline plus one `0000_snapshot.json`, then rewrite the local `drizzle.__drizzle_migrations` table so Drizzle sees the already-applied schema as matching that new baseline.

## Repository-Specific Locations

- SQL migrations: `server/drizzle/`
- Drizzle metadata: `server/drizzle/meta/`
- Drizzle config: `server/drizzle.config.ts`
- Local migration table: `drizzle.__drizzle_migrations` in the Postgres database

## Workflow

1. Inspect the current migration chain.
   - Read `server/drizzle/meta/_journal.json`.
   - Read the SQL files in `server/drizzle/`.
   - Inspect the latest snapshot in `server/drizzle/meta/`.

2. Fold the latest schema into the baseline migration.
   - Update `server/drizzle/0000_*.sql` so it directly creates the latest schema.
   - If later migrations added enum values, indexes, or constraints, move those into the baseline SQL.
   - Prefer direct `CREATE TABLE` constraints when possible, and keep separate `CREATE INDEX` statements when needed.

3. Collapse the metadata to one baseline snapshot.
   - Keep only `server/drizzle/meta/0000_snapshot.json`.
   - Ensure that snapshot reflects the latest schema, not the old baseline.
   - Set `prevId` in `0000_snapshot.json` to `00000000-0000-0000-0000-000000000000`.
   - Reduce `server/drizzle/meta/_journal.json` to one entry for the `0000_*` migration.

4. Remove later migration files.
   - Delete `server/drizzle/0001_*.sql` and above.
   - Delete `server/drizzle/meta/0001_snapshot.json` and above.

5. Recompute the baseline migration hash.
   - Run `shasum -a 256 server/drizzle/0000_*.sql`.
   - Drizzle stores the SHA-256 of the SQL file in `drizzle.__drizzle_migrations.hash`.

6. Rewrite the local Drizzle migration journal in Postgres.
   - Inspect the table with:
     - `docker compose exec -T kowalski_db psql -U kowalski_user -d kowalski -c "\d drizzle.__drizzle_migrations"`
   - Replace its rows with the single new baseline:
     - `TRUNCATE TABLE drizzle.__drizzle_migrations RESTART IDENTITY;`
     - `INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ('<new_sha256>', <journal_when_value>);`
   - This preserves the current schema and data while aligning Drizzle’s bookkeeping with the squashed files.

7. Verify.
   - Run `just migrate` and confirm it is a no-op or succeeds cleanly.
   - Run `just ready`.

## Safety Notes

- Prefer rewriting `drizzle.__drizzle_migrations` over dropping the DB when local data should be preserved.
- If the local database is disposable, `just clean-db` followed by `just migrate` is a simpler fallback, but it destroys data.
- Do not squash migrations after they have been shared broadly or applied in environments you cannot rewrite safely.

## Expected Outcome

- One baseline SQL migration in `server/drizzle/`
- One baseline snapshot in `server/drizzle/meta/`
- One row in `drizzle.__drizzle_migrations`
- `just ready` passes against the squashed migration history
