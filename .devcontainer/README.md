# Kowalski Dev Container

Open this repository in VS Code, then select **Dev Containers: Reopen in
Container**. The container starts PostgreSQL, installs the Node.js 26 backend
toolchain, and forwards the API ports:

- `8082` — application API and Swagger UI
- `8081` — daily API

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

The SwiftUI app targets Apple platforms and needs Xcode, so build and run it
from the macOS host rather than this Linux container.
