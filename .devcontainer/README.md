# Kowalski Dev Container

Open this repository in VS Code, then select **Dev Containers: Reopen in
Container**. The container starts PostgreSQL and installs the Node.js 26 backend
toolchain. Its API and daily ports come from this checkout's `.env`:
`KOWALSKI_SERVER_PORT` and `KOWALSKI_DAILY_PORT` (defaulting to 8082 and 8081).
Both ports are published on the host at the same numbers, so host tools and the
Swift app use the same URLs with or without the container.

Dependencies are installed automatically when the container is first created.
Run `just dev-server` from the integrated terminal to start the backend.

The devcontainer manages PostgreSQL and waits for it to become healthy before
opening the workspace. Inside the container, `just start-services` reuses that
database, and `just dev-server` and `just dev-daily` run migrations against
`db:5432` before starting the API.

After updating this configuration, select **Dev Containers: Rebuild Container**
to apply the `KOWALSKI_DEVCONTAINER=true` environment marker. Rebuilding preserves
the database volume. Run `just stop-services`, `just clean-db`, and `just tail-db`
from the host terminal; `just clean-db` deletes the database volume.

Use `just herdr-worktree <branch>` on the host to create a linked checkout with
its own database, API ports, Compose project, and env files. Each checkout's
container has its own database and `node_modules` volumes. Inside the container,
PostgreSQL is `db:5432`; on the host it uses `KOWALSKI_DB_PORT`. The shared Git
directory is mounted so Git works from linked worktrees inside the container.
The devcontainer startup check stops with an error if one of its assigned host
ports is already occupied by a different checkout or process.

The SwiftUI app targets Apple platforms and needs Xcode, so build and run it
from the macOS host rather than this Linux container.
