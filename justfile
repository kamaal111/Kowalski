set export
set dotenv-load

NVM_VERSION := "v0.40.3"

PN := "pnpm"
PNR := PN + " run"
PNX := PN + " exec"
TSX := PNX + " tsx"

COMPOSE_PROJECT_NAME := env_var_or_default("COMPOSE_PROJECT_NAME", "kowalski")
DATABASE_HOST := env_var_or_default("KOWALSKI_DB_HOST", "localhost")
DATABASE_PORT := env_var_or_default("KOWALSKI_DB_PORT", "5432")
DATABASE_NAME := env_var_or_default("KOWALSKI_DB_NAME", "kowalski")
DATABASE_USER := env_var_or_default("KOWALSKI_DB_USER", "kowalski_user")
DATABASE_PASSWORD := env_var_or_default("KOWALSKI_DB_PASSWORD", "kowalski_password")
DATABASE_URL := env_var_or_default("DATABASE_URL", "postgresql://" + DATABASE_USER + ":" + DATABASE_PASSWORD + "@" + DATABASE_HOST + ":" + DATABASE_PORT + "/" + DATABASE_NAME)
DOCKER_DATABASE_HOST := env_var_or_default("KOWALSKI_DOCKER_DB_HOST", "host.docker.internal")
SERVER_PORT := env_var_or_default("KOWALSKI_SERVER_PORT", "8080")
DAILY_PORT := env_var_or_default("KOWALSKI_DAILY_PORT", "8081")
DOCKER_IMAGE := "kowalski-server"
DOCKER_CONTAINER := env_var_or_default("KOWALSKI_DOCKER_CONTAINER", COMPOSE_PROJECT_NAME + "-server")
DOCKER_DATABASE_URL := env_var_or_default("DOCKER_DATABASE_URL", "postgresql://" + DATABASE_USER + ":" + DATABASE_PASSWORD + "@" + DOCKER_DATABASE_HOST + ":" + DATABASE_PORT + "/" + DATABASE_NAME)

SCHEME := "Kowalski"
MACOS_DESTINATION := "platform=macOS"

OUTPUT_SCHEMA_FILEPATH := "app/KowalskiClient/Sources/KowalskiClient/openapi.yaml"
SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH := ".." / OUTPUT_SCHEMA_FILEPATH
AUTH_CONFIG := "src/auth/better-auth.ts"
AUTH_SCHEMA := "src/db/schema/better-auth.ts"

# List available commands
default:
    just --list --unsorted

# Run dev server
[working-directory("server")]
dev-server: prepare-server start-services migrate fetch-daily-currencies
    #!/usr/bin/env zsh

    export DEBUG="true"
    export PORT="{{ SERVER_PORT }}"

    {{ PNR }} dev

# Run dev daily server
[working-directory("server")]
dev-daily: prepare-server start-services migrate
    #!/usr/bin/env zsh

    export DEBUG="true"
    export PORT="{{ DAILY_PORT }}"
    export MODE="DAILY"

    {{ PNR }} dev

# Run server
[working-directory("server")]
run-server: prepare-server compile-server
    #!/usr/bin/env zsh

    export PORT="{{ SERVER_PORT }}"
    export NODE_OPTIONS="--inspect"

    {{ PNR }} start

# Build server Docker image
[working-directory("server")]
docker-build-server tag=DOCKER_IMAGE:
    docker build -t {{ tag }} .

# Run server Docker image
[working-directory("server")]
docker-run-server tag=DOCKER_IMAGE host_port=SERVER_PORT: start-services
    docker run --rm --name {{ DOCKER_CONTAINER }} -p {{ host_port }}:{{ SERVER_PORT }} \
        --add-host=host.docker.internal:host-gateway --env-file .env -e PORT={{ SERVER_PORT }} \
        -e DATABASE_URL={{ DOCKER_DATABASE_URL }} {{ tag }}

# Run all verification checks
ready: _ready-tasks

# Run all verification checks for the server
[parallel]
ready-server: quality-server test-server

# Run quality checks for server
[parallel]
quality-server: check-spec lint-server format-check-server typecheck-server

# Prepare server for Linux CI
[linux]
prepare-server-ci: install-modules-ci

# Run verification checks including ui tests
heavy: heavy-tasks

# Generate isolated env files for a linked worktree
setup-worktree-env:
    {{ TSX }} .agents/skills/kowalski-git-worktree/scripts/setup-worktree-env.ts

# Compile server
[working-directory("server")]
compile-server:
    {{ PNR }} compile

# Run database migrations
[working-directory("server")]
migrate: prepare-server
    {{ PNX }} drizzle-kit migrate

# Fetch daily currencies unless today's snapshot is already stored
[working-directory("server")]
fetch-daily-currencies:
    {{ TSX }} scripts/fetch-daily-currencies.ts

# Generate migrations
[working-directory("server")]
make-migrations: prepare-server
    {{ PNX }} drizzle-kit generate

# Pull database schema
[working-directory("server")]
pull-schema: prepare-server
    {{ PNX }} drizzle-kit pull

# Push database schema
[working-directory("server")]
push-schema: prepare-server
    {{ PNX }} drizzle-kit push

# Start services
start-services:
    docker compose up -d

# Stop services
stop-services:
    docker compose down

# Stop services and remove volumes (clears database)
clean-db:
    docker compose down -v

# Tail database logs
tail-db:
    docker compose logs -f db

# Generate auth tables
[working-directory("server")]
make-auth-tables: prepare-server
    npx @better-auth/cli generate --config {{ AUTH_CONFIG }} --output {{ AUTH_SCHEMA }} --yes

# Generate OpenAPI specification
[working-directory("server")]
download-spec:
    #!/usr/bin/env bash

    echo "🚀 Generating OpenAPI spec to {{ SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH }}..."
    {{ TSX }} scripts/download-openapi-spec.ts {{ SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH }}

# Verify the committed OpenAPI specification is up to date
check-spec: download-spec
    #!/usr/bin/env bash

    if ! git diff --quiet --exit-code -- "{{ OUTPUT_SCHEMA_FILEPATH }}"
    then
        echo ""
        echo "❌ OpenAPI spec is out of date. Run \`just download-spec\` and commit the updated file."
        git --no-pager diff -- "{{ OUTPUT_SCHEMA_FILEPATH }}"
        exit 1
    fi

    echo "✅ OpenAPI spec is up to date."

# Lint the project
[parallel]
lint: lint-server lint-app

# Lint server
lint-server:
    {{ PNR }} lint

# Lint app
[working-directory("app")]
lint-app:
    swiftlint lint

# Format code
[parallel]
format: format-server format-app

# Format server code with Oxfmt
format-server:
    {{ PNR }} format

# Format app code with SwiftFormat
[working-directory("app")]
format-app:
    swiftformat .

# Check code formatting
[parallel]
format-check: format-check-server format-check-app

# Check server code formatting with Oxfmt
format-check-server:
    {{ PNR }} format:check

# Check app code formatting with SwiftFormat
[working-directory("app")]
format-check-app:
    swiftformat --lint .

# Type check
typecheck: typecheck-server

# Type check server
[working-directory("server")]
typecheck-server:
    {{ PNR }} typecheck

# Run tests (excluding app UI tests)
[parallel]
test: test-server test-app

# Run app tests (excluding UI tests)
[working-directory("app")]
test-app:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -skip-testing:KowalskiUITests

# Run verification checks in CI for app
[parallel]
ready-app-ci: quality-app test-app-ci

# Run quality checks for app
[parallel]
quality-app: lint-app format-check-app

# Run app tests in CI
[working-directory("app")]
test-app-ci:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -skipPackagePluginValidation \
        CODE_SIGNING_ALLOWED=NO \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGN_IDENTITY=""

# Run app UI tests (only when explicitly requested)
[working-directory("app")]
test-ui:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -only-testing:KowalskiUITests

# Run app UI tests and unit tests
[working-directory("app")]
test-app-heavy:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }}

# Run server tests
[working-directory("server")]
test-server:
    {{ PNR }} test

# Run all tests
[parallel]
test-heavy: test-server test-app-heavy

# Run quality checks
[parallel]
quality: check-spec lint format-check typecheck

# Open app in Xcode
[working-directory("app")]
xcode:
    open Kowalski.xcodeproj

# Prepare project to work with
prepare: install-modules prepare-server

# Prepare server
prepare-server: install-modules-server

# Bootstrap project
bootstrap: prepare bootstrap-server bootstrap-app

# Bootstrap server
bootstrap-server: prepare-server

# Bootstrap app
bootstrap-app: install-brew-packages

[private]
install-brew-packages:
    brew update
    brew bundle

[private]
[parallel]
_ready-tasks: quality test

[private]
[parallel]
heavy-tasks: quality test-heavy

[private]
install-modules:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    echo "Y" | {{ PN }} i

[private]
install-modules-ci:
    pnpm install --frozen-lockfile
    pnpm --dir server install --frozen-lockfile

[private]
[working-directory("server")]
install-modules-server:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    echo "Y" | {{ PN }} i
