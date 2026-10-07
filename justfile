set export
set dotenv-load

NVM_VERSION := "v0.40.3"

PN := "pnpm"
PNR := PN + " run"
PNX := PN + " exec"

COMPOSE_PROJECT_NAME := env("COMPOSE_PROJECT_NAME", "kowalski")
DATABASE_HOST := env("KOWALSKI_DB_HOST", "localhost")
DATABASE_PORT := env("KOWALSKI_DB_PORT", "5432")
DATABASE_NAME := env("KOWALSKI_DB_NAME", "kowalski")
DATABASE_USER := env("KOWALSKI_DB_USER", "kowalski_user")
DATABASE_PASSWORD := env("KOWALSKI_DB_PASSWORD", "kowalski_password")
DATABASE_URL := env("DATABASE_URL", "postgresql://" + DATABASE_USER + ":" + DATABASE_PASSWORD + "@" + DATABASE_HOST + ":" + DATABASE_PORT + "/" + DATABASE_NAME)
DOCKER_DATABASE_HOST := env("KOWALSKI_DOCKER_DB_HOST", "host.docker.internal")
SERVER_PORT := env("KOWALSKI_SERVER_PORT", "8082")
DAILY_PORT := env("KOWALSKI_DAILY_PORT", "8081")
DOCKER_IMAGE := "kowalski-server"
DOCKER_CONTAINER := env("KOWALSKI_DOCKER_CONTAINER", COMPOSE_PROJECT_NAME + "-server")
DOCKER_DATABASE_URL := env("DOCKER_DATABASE_URL", "postgresql://" + DATABASE_USER + ":" + DATABASE_PASSWORD + "@" + DOCKER_DATABASE_HOST + ":" + DATABASE_PORT + "/" + DATABASE_NAME)

UI_TEST_NAME := "KowalskiUITests"

SCHEME := "Kowalski"
MACOS_DESTINATION := "platform=macOS"

OUTPUT_SCHEMA_FILEPATH := "app/KowalskiClient/Sources/KowalskiClient/openapi.yaml"
SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH := ".." / OUTPUT_SCHEMA_FILEPATH
AUTH_CONFIG := "src/auth/better-auth.ts"
AUTH_SCHEMA := "src/db/schema/better-auth.ts"

alias z := zed

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
run-server: prepare-server
    #!/usr/bin/env zsh

    export PORT="{{ SERVER_PORT }}"
    export NODE_OPTIONS="--inspect"

    {{ PNR }} start

# Build server Docker image
docker-build-server tag=DOCKER_IMAGE:
    docker build -f server/Dockerfile -t {{ tag }} .

# Run server Docker image
[working-directory("server")]
docker-run-server tag=DOCKER_IMAGE host_port=SERVER_PORT: start-services
    docker run --rm --name {{ DOCKER_CONTAINER }} -p {{ host_port }}:{{ SERVER_PORT }} \
        --add-host=host.docker.internal:host-gateway --env-file .env -e PORT={{ SERVER_PORT }} \
        -e DATABASE_URL={{ DOCKER_DATABASE_URL }} {{ tag }}

# Run all verification checks
ready: _ready-tasks

# Inspect JWT signing keys without changing data or printing secrets
[working-directory("server")]
diagnose-auth-keys:
    node src/auth/signing-keys-command.ts

# Retire unreadable signing keys while retaining public keys, users, and sessions
[working-directory("server")]
repair-auth-keys:
    node src/auth/signing-keys-command.ts --repair

# Run all verification checks for the app
[parallel]
ready-app: quality-app quality-tools test-app test-localization-check

# Run all verification checks for the server
[parallel]
ready-server: quality-server test-server

# Run quality checks for server
[parallel]
quality-server: check-spec lint-server format-check-server typecheck-server

# Prepare server for Linux CI
[linux]
[parallel]
prepare-server-ci: install-modules-ci start-services

# Run verification checks including ui tests
heavy: heavy-tasks

# Generate isolated env files for a linked worktree
setup-worktree-env:
    node .agents/skills/kowalski-git-worktree/scripts/setup-worktree-env.ts

# Create a Herdr worktree with isolated host and devcontainer ports
[positional-arguments]
herdr-worktree branch:
    node scripts/create-herdr-worktree.ts "$1"

# Type check the server without emitting
[working-directory("server")]
compile-server:
    {{ PNR }} typecheck

# Rebuild the native SQLite driver after a Node.js upgrade
[working-directory("server")]
rebuild-better-sqlite3:
    {{ PN }} rebuild better-sqlite3

# Run database migrations
[working-directory("server")]
migrate: prepare-server
    {{ PNX }} drizzle-kit migrate

# Fetch daily currencies unless today's snapshot is already stored
[working-directory("server")]
fetch-daily-currencies:
    node scripts/fetch-daily-currencies.ts

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
    #!/usr/bin/env bash

    if [ "${KOWALSKI_DEVCONTAINER:-false}" = "true" ]; then
        echo "Using PostgreSQL managed by the devcontainer"
        exit 0
    fi

    docker compose up -d --wait

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
    {{ PN }} dlx @better-auth/cli generate --config {{ AUTH_CONFIG }} --output {{ AUTH_SCHEMA }} --yes

# Generate OpenAPI specification
[working-directory("server")]
download-spec:
    #!/usr/bin/env bash

    echo "🚀 Generating OpenAPI spec to {{ SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH }}..."
    node scripts/download-openapi-spec.ts {{ SERVER_RELATIVE_OUTPUT_SCHEMA_FILEPATH }}

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
typecheck: typecheck-server typecheck-scripts

# Type check worktree scripts
typecheck-scripts:
    {{ PNX }} tsc -p tsconfig.scripts.json

# Type check server
[working-directory("server")]
typecheck-server:
    {{ PNR }} typecheck

# Run tests (excluding app UI tests)
[parallel]
test: test-server test-app test-herdr-worktree test-localization-check test-affected-areas

# Test worktree environment allocation
test-herdr-worktree:
    node --test scripts/worktree-env.test.ts

# Check compiler-extracted macOS keys against catalogs; run app tests first
check-localizations platform:
    node scripts/check-localizations.ts {{ platform }}

# Test localization validation using isolated compiler-output fixtures
test-localization-check:
    node --test scripts/check-localizations.test.ts

# Test CI routing for localization tooling and app changes
test-affected-areas:
    bash .github/scripts/determine-affected-areas.test.sh

# Check TypeScript verification tools without building the app
[parallel]
quality-tools: lint-server format-check-server typecheck-scripts

# Run app tests (excluding UI tests)
[working-directory("app")]
test-app:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -skip-testing:{{ UI_TEST_NAME }} SWIFT_EMIT_LOC_STRINGS=YES
    just --justfile ../justfile check-localizations macos

# Run verification checks in CI for app
[parallel]
ready-app-ci: quality-app quality-tools test-app-ci test-localization-check

# Run quality checks for app
[parallel]
quality-app: lint-app format-check-app

# Run app tests in CI
[working-directory("app")]
test-app-ci:
    #!/usr/bin/env bash
    set -euo pipefail
    result_directory=$(mktemp -d "${TMPDIR:-/tmp}/kowalski-tests.XXXXXX")
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -skip-testing:{{ UI_TEST_NAME }} \
        -skipPackagePluginValidation \
        -resultBundlePath "$result_directory/TestResults.xcresult" \
        SWIFT_EMIT_LOC_STRINGS=YES \
        CODE_SIGNING_ALLOWED=NO \
        CODE_SIGNING_REQUIRED=NO \
        CODE_SIGN_IDENTITY=""
    just --justfile ../justfile check-localizations macos

# Run app UI tests (only when explicitly requested)
[working-directory("app")]
test-ui:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} \
        -only-testing:{{ UI_TEST_NAME }}

# Run app UI tests and unit tests
[working-directory("app")]
test-app-heavy:
    xcodebuild test -scheme {{ SCHEME }} -destination {{ MACOS_DESTINATION }} SWIFT_EMIT_LOC_STRINGS=YES
    just --justfile ../justfile check-localizations macos

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

# Open project in zed
zed:
    zed .

# Open project in vscode
code:
    code kowalski.code-workspace

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
    {{ PN }} i

[private]
install-modules-ci:
    pnpm install --frozen-lockfile
    pnpm --dir server install --frozen-lockfile

[private]
[working-directory("server")]
install-modules-server:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    {{ PN }} i
