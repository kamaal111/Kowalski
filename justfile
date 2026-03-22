set export

NVM_VERSION := "v0.40.3"

PN := "pnpm"
PNR := PN + " run"

OUTPUT_SCHEMA_FILEPATH := "app/KowalskiClient/Sources/KowalskiClient/openapi.yaml"

# List available commands
default:
    just --list --unsorted

# Run dev server
dev-server: start-services
    just server/dev-server

# Run dev daily server
dev-daily: start-services
    just server/dev-daily

# Run server
run-server:
    just server/run-server

# Build server Docker image
docker-build-server:
    just server/docker-build

# Run server Docker image
docker-run-server: start-services
    just server/docker-run

# Run all verification checks
ready: quality download-spec test

# Compile server
compile-server:
    just server/compile

# Run database migrations
migrate:
    just server/migrate

# Generate migrations
make-migrations:
    just server/make-migrations

# Pull database schema
pull-schema:
    just server/pull-schema

# Push database schema
push-schema:
    just server/push-schema

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
make-auth-tables:
    just server/make-auth-tables

# Download OpenAPI specification
download-spec:
    just server/download-spec ../{{ OUTPUT_SCHEMA_FILEPATH }}

# Lint the project
lint:
    {{ PNR }} lint

# Format code with Prettier
format:
    {{ PNR }} format

# Check code formatting with Prettier
format-check:
    {{ PNR }} format:check

# Type check
typecheck:
    just server/typecheck

# Run tests (server + Swift client)
test: start-services
    just server/test
    just app/test

# Run quality checks
quality: lint format-check typecheck

# Prepare project to work with
prepare: install-modules
    just server/prepare

# Bootstrap project
bootstrap: prepare
    just server/bootstrap

[private]
install-modules:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    echo "Y" | {{ PN }} i
