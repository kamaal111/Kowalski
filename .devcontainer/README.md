# Kowalski Dev Container

Open this repository in VS Code, then select **Dev Containers: Reopen in
Container**. The container starts PostgreSQL, installs the Node.js 26 backend
toolchain, and forwards the API ports:

- `8082` — application API and Swagger UI
- `8081` — daily API

Dependencies are installed automatically when the container is first created.
Run `just dev-server` from the integrated terminal to start the backend.

The SwiftUI app targets Apple platforms and needs Xcode, so build and run it
from the macOS host rather than this Linux container.
