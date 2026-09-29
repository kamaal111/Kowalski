import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  availablePorts,
  mainWorktreePath,
  readOptional,
  worktreeEnv,
  worktreePaths,
  writeWorktreeEnv,
} from './worktree-env.ts';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function run(command: string, args: string[], inherit = false): string {
  const result = spawnSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe' });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args[0]} failed: ${result.stderr?.trim() ?? ''}`);
  }

  return result.stdout ?? '';
}

async function main(): Promise<void> {
  const branch = process.argv[2];

  if (branch === undefined || process.argv.length !== 3) {
    throw new Error('Usage: just herdr-worktree <new-branch>');
  }

  run('git', ['check-ref-format', '--branch', branch]);

  const exists = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { cwd: repoRoot });

  if (exists.error) {
    throw exists.error;
  }

  if (exists.status === 0) {
    throw new Error(`Branch ${branch} already exists`);
  }

  if (exists.status !== 1) {
    throw new Error(`Could not check branch ${branch}`);
  }

  const source = await readOptional(path.join(repoRoot, '.env'));

  if (source === undefined) {
    throw new Error('Create root .env before creating a worktree');
  }

  const ports = await availablePorts(repoRoot);
  const contents = worktreeEnv(source, ports, branch);
  const sourceMode = (await fs.stat(path.join(repoRoot, '.env'))).mode & 0o777;
  const parentCheckout = mainWorktreePath(run('git', ['worktree', 'list', '--porcelain']));

  run('git', ['fetch', 'origin', 'main'], true);
  run(
    'herdr',
    ['worktree', 'create', '--cwd', parentCheckout, '--branch', branch, '--base', 'origin/main', '--no-focus'],
    true,
  );

  const checkout = worktreePaths(repoRoot).find(candidate => {
    const result = spawnSync('git', ['-C', candidate, 'symbolic-ref', '--short', 'HEAD'], { encoding: 'utf8' });

    return result.status === 0 && result.stdout.trim() === branch;
  });

  if (checkout === undefined) {
    throw new Error(`Herdr created ${branch}, but its checkout was not found`);
  }

  await writeWorktreeEnv(checkout, contents, true);
  await fs.chmod(path.join(checkout, '.env'), sourceMode);
  console.log(
    `Created ${checkout}: database ${ports.db}, server ${ports.server}, daily ${ports.daily}, Compose ${contents.project}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
