---
name: git-worktree-best-practices
description: Reusable workflow for linked git worktrees. Use when the checkout is a worktree, `HEAD` may be detached, a branch needs upstream tracking, a task requires worktree-safe sync or publish steps, or git operations should be isolated from the user's main checkout.
---

# Git Worktree Best Practices

## Overview

Apply this skill when git state is part of the task, not just the code change. Keep the branch attached, reviewable, and safe to publish without disturbing the user's main checkout.

## Inspect State First

- Run `git status --short`.
- Run `git rev-parse --abbrev-ref HEAD`.
- Run `git branch -vv`.
- Run `git log --oneline --decorate -n 6`.
- Determine whether the worktree is attached or detached before pulling, committing, or pushing.
- Prefer a clean dedicated worktree when the user's main checkout is dirty or mixed with unrelated changes.

## Prepare The Worktree

- Read the repository guidance before doing state-changing git work.
- Run any repository-specific worktree bootstrap step before commands that touch services, ports, generated artifacts, or env files.
- Treat worktree-local env files as setup artifacts, not user-facing deliverables.
- Keep shared defaults untouched unless the repository explicitly wants worktree-local overrides.

## Reattach And Sync Carefully

- If `HEAD` is detached, switch to the expected branch before doing sync, amend, push, or PR work.
- If the expected branch is unclear, inspect tracking info, recent commits, and any open PR context before switching.
- If `git pull --rebase` reports missing tracking information, set the upstream branch explicitly and retry.
- Prefer `git pull --rebase` when the task is to sync the current branch.
- Keep rebases and other state-changing git operations out of the user's main checkout. Use a dedicated worktree instead.

## Stage And Commit Intentionally

- Stage only the files that belong in scope.
- Use review-friendly commit messages with a declarative title and an explanatory body.
- If the user wants a single commit, prefer `git commit --amend --no-edit` when only the tree changes, or `git commit --amend` when the message also needs to change.
- Expect commit hooks to rewrite files. Verify the final committed tree after hooks run.

## Publish Safely

- Publish worktree changes as a PR when the task includes shareable branch work and the user has not opted out.
- For the first push from an untracked or detached state, use an explicit `HEAD:refs/heads/<branch>` push target when needed.
- After an amend, prefer `git push --force-with-lease`.
- Fetch again before staging or pushing if verification took long enough for remote history to move.

## Respect Sandbox And Permission Boundaries

- Expect linked worktree git commands to require elevated permissions when metadata lives outside the immediate working tree.
- Retry blocked `git switch`, `git add`, `git commit`, `git pull --rebase`, `git branch --set-upstream-to`, or `git push` commands with the required escalation instead of treating the first sandbox failure as a git failure.

## Verify The Final Tree

- Run the repository-required checks for the actual change type.
- Skip heavyweight final verification only when the repository explicitly allows it for docs-only work.
- Rerun verification after amend or rebase steps when hooks or conflict resolution may have changed the final tree.

## Expected Output When Using This Skill

Finish by stating:

- whether the worktree started attached or detached
- whether upstream tracking changed
- which sync command ran
- whether the branch was amended or force-pushed
- whether a PR was created or updated
- which verification commands ran, or why validation was intentionally skipped
