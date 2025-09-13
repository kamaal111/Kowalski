set export

NVM_VERSION := "v0.40.3"
NODE_VERSION := "24"

NVM := "nvm"
PN := "pnpm"
PNR := PN + " run"

OUTPUT_SCHEMA_FILEPATH := "app/KowalskiClient/Sources/KowalskiClient/openapi.yaml"

# List available commands
default:
    just --list --unsorted

# Run dev server
dev-server:
    just server/dev-server

# Run server
run-server:
    just server/run-server

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

# Tail database logs
tail-db:
    docker compose logs -f db

# Generate auth tables
make-auth-tables:
    just server/make-auth-tables

# Download OpenAPI specification (requires running server)
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

# Run tests
test:
    just server/test

# Run quality checks
quality: lint format-check typecheck

# Prepare project to work with
prepare: install-modules
    just server/prepare

# Bootstrap project
bootstrap: install-nvm install-node enable-corepack prepare
    just server/bootstrap

[private]
install-modules:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    echo "Y" | {{ PN }} i

[private]
enable-corepack:
    #!/usr/bin/env zsh

    . ~/.zshrc || true
    corepack enable

[private]
install-nvm:
    #!/usr/bin/env zsh

    if [ -s "$HOME/.nvm/nvm.sh" ] || [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] || [ -s "/usr/local/opt/nvm/nvm.sh" ]
    then
        echo "NVM is already installed"
        # Source NVM and show version
        [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
        [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
        [ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"
        {{ NVM }} --version 2>/dev/null || echo "NVM script found but not loaded in current session"
    else
        echo "Installing NVM..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/{{ NVM_VERSION }}/install.sh | bash
        echo "NVM installed. Please restart your terminal or run 'source ~/.zshrc' to use nvm"
    fi

[private]
install-node:
    #!/usr/bin/env zsh

    # Source NVM
    [ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
    [ -s "/opt/homebrew/opt/nvm/nvm.sh" ] && . "/opt/homebrew/opt/nvm/nvm.sh"
    [ -s "/usr/local/opt/nvm/nvm.sh" ] && . "/usr/local/opt/nvm/nvm.sh"
    
    if ! command -v {{ NVM }} &> /dev/null
    then
        echo "NVM not found. Please run 'just install-nvm' first."
        exit 1
    fi
    
    echo "Checking for Node.js version {{ NODE_VERSION }}..."
    
    if {{ NVM }} list | grep -q "v{{ NODE_VERSION }}"
    then
        echo "Node.js {{ NODE_VERSION }} is already installed"
        {{ NVM }} use {{ NODE_VERSION }}
        {{ NVM }} alias default {{ NODE_VERSION }}
        echo "Set Node.js {{ NODE_VERSION }} as default"
    else
        echo "Installing Node.js {{ NODE_VERSION }}..."
        {{ NVM }} install {{ NODE_VERSION }}
        {{ NVM }} use {{ NODE_VERSION }}
        {{ NVM }} alias default {{ NODE_VERSION }}
        echo "Node.js {{ NODE_VERSION }} installed and set as default"
    fi
    
    echo "Current Node.js version: $(node --version)"
    echo "Current npm version: $(npm --version)"
