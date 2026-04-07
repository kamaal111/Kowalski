---
name: kowalski-git-worktree
description: Repository-specific workflow for working safely in Kowalski git worktrees. Use when the checkout is a linked worktree, `HEAD` is detached, a branch needs upstream tracking, the task requires isolated database or port setup, `git pull --rebase`, `git commit --amend`, `git push --force-with-lease`, or the work must be published as a GitHub PR from a worktree branch.
---

# Kowalski Git Worktree

## Overview

Use this skill when git worktree state is part of the task, not just the code change. The goal is to keep the branch attached, synced, reviewable, and safely publishable from a linked worktree.

## Start Here

- Inspect state before changing it:
  - `git status --short`
  - `git rev-parse --abbrev-ref HEAD`
  - `git branch -vv`
  - `git log --oneline --decorate -n 6`
- Confirm whether you are in a detached `HEAD` state before pulling, committing, or pushing.
- Read `AGENTS.md` before doing state-changing git work so you follow the repository's worktree rules.
- Before running recipes that touch PostgreSQL, server ports, or OpenAPI download, run:
  - `just setup-worktree-env`
- Treat the generated root `.env` and `server/.env` as part of worktree setup, not as user-facing deliverables. They should point the worktree at its own Compose project, database name, database port, and server ports.
- If the user's main checkout is dirty or mixed, prefer a clean temp worktree for the task rather than trying to separate unrelated changes in place.

## Isolated Environment

- Use `just setup-worktree-env` once near the start of a new linked worktree or whenever env files are missing.
- The helper writes:
  - `.env` in the repo root so `just` recipes pick up worktree-specific overrides
  - `server/.env` so direct server commands in `server/` use the same database and auth URL
- The helper chooses:
  - a non-`5432` PostgreSQL host port
  - worktree-specific server and daily ports
  - a unique `COMPOSE_PROJECT_NAME` so Docker containers and volumes do not collide across worktrees
- If the default ports are somehow busy, rerun the helper directly with overrides:
  - `pnpm exec tsx .agents/skills/kowalski-git-worktree/scripts/setup-worktree-env.ts --db-port <port> --server-port <port> --daily-port <port>`
- Keep local-development defaults for the main checkout. Do not change shared repo defaults just to fit a worktree.

## Reattach the Branch

- If `git rev-parse --abbrev-ref HEAD` returns `HEAD`, reattach before doing anything else:
  - `git switch <expected-branch>`
- If the expected branch is unclear, inspect `git branch -vv`, recent commits, and the open PR branch name before switching.
- Do not leave the worktree on detached `HEAD` if the task includes sync, amend, push, or PR updates.

## Upstream Tracking and Sync

- If `git pull --rebase` says there is no tracking information, set it explicitly:
  - `git branch --set-upstream-to=origin/<branch> <branch>`
- Before starting a follow-up branch for already-merged work, verify whether the local branch still matches `origin/main`; if not, start the new worktree from fresh `origin/main` instead of assuming the old topic branch is still the right base.
- When the user asks to sync the current PR branch, prefer:
  - `git pull --rebase`
- If the task explicitly says to sync with `main`, first confirm whether `origin/main` is already the branch base by checking recent history and `git branch -vv`.
- Rebase and other state-changing git commands are allowed only in a dedicated worktree, not the user's main worktree.

## Staging, Commit, and Amend

- Stage only the files that belong in scope.
- Use review-friendly commit messages with both:
  - a declarative title
  - a body that explains what changed, why, and the important files or behaviors
- If the user asks for a single commit, prefer:
  - `git commit --amend --no-edit`
  - or `git commit --amend` if the message also needs to change
- Expect commit hooks to rewrite staged files. After hooks run, verify the final committed tree, not the pre-commit tree.

## Push and PR Updates

- Publish worktree changes as a GitHub pull request unless the user explicitly says not to.
- For a first push from a worktree branch without local tracking, use:
  - `git push -u origin HEAD:refs/heads/<branch>`
- If the branch is intentionally detached because the named branch is already checked out elsewhere, it is acceptable to commit on `HEAD` and push with `HEAD:refs/heads/<branch>`.
- After `git commit --amend`, update the remote with:
  - `git push --force-with-lease origin <branch>`
- Prefer the GitHub connector for PR creation or updates when available.
- If `gh auth status` shows an invalid token, do not block on `gh`; use the GitHub connector path instead.
- If verification takes a while, fetch again right before staging or pushing so you do not accidentally publish on top of stale remote history.

## Sandbox Notes

- In linked worktrees, git metadata usually lives under the parent repository's `.git/worktrees/...` directory.
- Because of that layout, these commands often need escalated permissions:
  - `git switch`
  - `git branch --set-upstream-to=...`
  - `git add`
  - `git commit`
  - `git pull --rebase`
  - `git push`
- Do not treat those permission prompts as a git failure until you have retried with the needed escalation.

## Verification

- Follow the repository verification rules for the actual change type.
- For docs-only work, do not run `just ready` unless the user explicitly asks for it.
- For code changes, rerun the required checks after any amend if hooks or rebases could have changed the final tree.

## Expected Output When Using This Skill

Finish by stating:

- whether `just setup-worktree-env` ran and which ports or compose project it configured
- whether the worktree started detached or attached
- whether upstream tracking had to be configured
- which sync command ran
- whether a PR was created or updated
- whether the branch was amended or force-pushed
- which verification commands ran, or why docs-only validation was skipped
