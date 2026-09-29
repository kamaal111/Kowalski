#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

env_value() {
    sed -n "s/^$1=//p" .env | tail -n 1 | tr -d "\"'"
}

workspace_folder="$(pwd -P)"
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
project="$(env_value COMPOSE_PROJECT_NAME)"
if [[ -z "$project" ]]; then
    project="kowalski-devcontainer-$(printf '%s' "$workspace_folder" | git hash-object --stdin | cut -c 1-12)"
fi

server_port="$(env_value KOWALSKI_SERVER_PORT)"
server_port="${server_port:-8082}"
daily_port="$(env_value KOWALSKI_DAILY_PORT)"
daily_port="${daily_port:-8081}"
db_port="$(env_value KOWALSKI_DB_PORT)"
db_port="${db_port:-5432}"

own_published_ports="$(docker ps --filter "label=com.docker.compose.project=$project" --format '{{.Ports}}')"
for port in "$server_port" "$daily_port" "$db_port"; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null && [[ "$own_published_ports" != *":$port->"* ]]; then
        echo "Port $port is already in use on the host. Assign free ports with just herdr-worktree or just setup-worktree-env." >&2
        exit 1
    fi
done

cp .env .devcontainer/.env
chmod 600 .devcontainer/.env
cat >> .devcontainer/.env <<ENV
LOCAL_WORKSPACE_FOLDER=${workspace_folder}
GIT_COMMON_DIR=${git_common_dir}
KOWALSKI_DEVCONTAINER_PROJECT=${project}
KOWALSKI_DEVCONTAINER_SERVER_PORT=${server_port}
KOWALSKI_DEVCONTAINER_DAILY_PORT=${daily_port}
ENV
