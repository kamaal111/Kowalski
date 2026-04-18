---
name: kowalski-git-worktree
description: Repository-specific overlay for Kowalski git worktrees. Use with `git-worktree-best-practices` when the checkout is a linked worktree, `HEAD` is detached, a branch needs upstream tracking, the task requires isolated database or port setup, `git pull --rebase`, `git commit --amend`, `git push --force-with-lease`, or the work must be published as a GitHub PR from a worktree branch.
---

# Kowalski Git Worktree

## Overview

Load [git-worktree-best-practices](../git-worktree-best-practices/SKILL.md) first. Use this skill for Kowalski's worktree env bootstrap, exact helper script paths, and repository-specific publish expectations.

## Prepare Kowalski Worktrees

- Read `AGENTS.md` before doing state-changing git work.
- Run `just setup-worktree-env` before recipes that touch PostgreSQL, server ports, or OpenAPI download.
- Treat the generated root `.env` and `server/.env` files as worktree setup artifacts, not user-facing deliverables.
- Expect those env files to point the worktree at its own Compose project, database name, database port, and server ports.
- If the user's main checkout is dirty or mixed, prefer a clean temp worktree for the task.

## Use Kowalski's Worktree Helper

- Expect `just setup-worktree-env` to choose a non-`5432` PostgreSQL host port, worktree-specific server and Daily ports, and a unique `COMPOSE_PROJECT_NAME`.
- Rerun the helper directly with overrides when the default ports are busy:
  - `pnpm exec tsx .agents/skills/kowalski-git-worktree/scripts/setup-worktree-env.ts --db-port <port> --server-port <port> --daily-port <port>`
- Keep the main checkout on the shared local-development defaults.

## Publish Kowalski Branches

- Publish worktree changes as a GitHub pull request unless the user explicitly says not to.
- Prefer the GitHub connector for PR creation or updates when available.
- If `gh auth status` is stale or invalid, use the GitHub connector path instead of blocking on CLI auth.

## Expect Kowalski Sandbox Friction

- Expect linked-worktree git commands to need escalation because metadata often lives under the parent repository's `.git/worktrees/...`.

## Expected Output When Using This Skill

Finish by stating:

- whether `just setup-worktree-env` ran and which ports or compose project it configured
- whether upstream tracking had to be configured
- whether a PR was created or updated
- which verification commands ran, or why docs-only validation was skipped
