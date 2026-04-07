set export
set dotenv-load

NVM_VERSION := "v0.40.3"

PN := "pnpm"
PNR := PN + " run"
PNX := PN + " exec"
TSX := PNX + " tsx"

SERVER_PORT := "8080"
DAILY_PORT := "8081"
DOCKER_IMAGE := "kowalski-server"
DOCKER_CONTAINER := "kowalski-server"
DOCKER_DATABASE_URL := "postgresql://kowalski_user:kowalski_password@host.docker.internal:5432/kowalski"

SCHEME := "Kowalski"
MACOS_DESTINATION := "platform=macOS"

OUTPUT_SCHEMA_FILEPATH := "app/KowalskiClient/Sources/KowalskiClient/openapi.yaml"
AUTH_CONFIG := "src/auth/better-auth.ts"
AUTH_SCHEMA := "src/db/schema/better-auth.ts"

# List available commands
default:
    just --list --unsorted

# Run dev server
[working-directory("server")]
dev-server: prepare-server start-services migrate
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
ready: download-spec _ready-tasks

# Run all verification checks for the server
[parallel]
ready-server: quality-server test-server

# Run quality checks for server
[parallel]
quality-server: lint-server format-check-server typecheck-server

# Prepare server for Linux
[linux]
[parallel]
prepare-server-linux: install-zsh install-modules-ci

# Run verification checks including ui tests
heavy: download-spec heavy-tasks

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
fetch-daily-currencies: start-services migrate
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

# Download OpenAPI specification
[working-directory("server")]
download-spec:
    #!/usr/bin/env zsh

    OUTPUT="../{{ OUTPUT_SCHEMA_FILEPATH }}"
    SERVER_URL="http://localhost:{{ SERVER_PORT }}"

    echo "🚀 Auto-downloading OpenAPI spec to $OUTPUT..."

    # Check if server is already running
    if curl -s --fail --connect-timeout 2 "$SERVER_URL/spec.json" > /dev/null 2>&1
    then
        echo "✅ Server is already running"
        {{ TSX }} scripts/download-openapi-spec.ts "$OUTPUT" "$SERVER_URL"
    else
        echo "🔄 Server not running, starting development server..."
        echo "   This will start the server in the background and download the spec"

        just run-server &

        echo "⏳ Waiting for server to start..."
        for i in {1..30}; do
            if curl -s --fail --connect-timeout 2 "$SERVER_URL/spec.json" > /dev/null 2>&1
            then
                echo "✅ Server is ready!"
                break
            fi
            if [ $i -eq 30 ]
            then
                echo "❌ Server failed to start within 30 seconds"
                kill $(lsof -t -i:{{ SERVER_PORT }}) || true
                exit 1
            fi
            echo "   Attempt $i/30..."
            sleep 1
        done

        npx tsx scripts/download-openapi-spec.ts "$OUTPUT" "$SERVER_URL"

        echo "🛑 Stopping development server..."
        kill $(lsof -t -i:{{ SERVER_PORT }}) || true
        echo "✅ Done! OpenAPI spec saved to $OUTPUT"
    fi

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
quality: lint format-check typecheck

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
[linux]
install-modules-ci:
    pnpm install --frozen-lockfile
    pnpm --dir server install --frozen-lockfile

[private]
[working-directory("server")]
install-modules-server:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    echo "Y" | {{ PN }} i

[private]
[linux]
install-zsh:
    sudo apt-get update
    sudo apt-get install -y zsh
