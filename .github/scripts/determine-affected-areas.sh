#!/bin/bash

set -euo pipefail

# Load configuration
config_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config/affected-areas.conf"
if [[ ! -f "$config_file" ]]; then
  echo "Error: Configuration file not found at $config_file" >&2
  exit 1
fi
source "$config_file"

if [[ "$EVENT_NAME" == "push" && "$REF_NAME" == "main" ]]
then
  echo "server=true" >> "$GITHUB_OUTPUT"
  echo "app=true" >> "$GITHUB_OUTPUT"
  echo "Running all jobs for pushes to main."
  exit 0
fi

git fetch --no-tags --prune --depth=1 origin main
base_commit="$(git merge-base HEAD origin/main)"
mapfile -t changed_files < <(git diff --name-only "$base_commit"...HEAD)

if ((${#changed_files[@]} == 0))
then
  echo "No files changed relative to origin/main."
else
  echo "Changed files relative to origin/main ($base_commit):"
  printf '%s\n' "${changed_files[@]}"
fi

server=false
app=false

for file in "${changed_files[@]}"
do
  # Use eval to properly expand pattern variables in case statement
  eval "case \"$file\" in
    $BOTH)
      server=true
      app=true
      ;;
    $SERVER)
      server=true
      ;;
    $APP)
      app=true
      ;;
  esac"
done

echo "server=$server" >> "$GITHUB_OUTPUT"
echo "app=$app" >> "$GITHUB_OUTPUT"
