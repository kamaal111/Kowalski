import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { envValues, mainWorktreePath, parsePort, renderEnv, selectPorts, worktreeEnv } from './worktree-env.ts';

const source = `# Local development
DATABASE_URL=postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski
BETTER_AUTH_SECRET=keep-this-secret
BETTER_AUTH_URL=http://localhost:8082
CUSTOM_SETTING=keep-this-value
`;

void describe('worktree environment', () => {
  void it('assigns matching URLs and Compose values while preserving unrelated settings', () => {
    const result = worktreeEnv(source, { db: 15432, server: 8100, daily: 9000 }, 'feature/one');
    const root = envValues(result.root);
    const server = envValues(result.server);

    assert.equal(root.get('KOWALSKI_DB_PORT'), '15432');
    assert.equal(root.get('KOWALSKI_SERVER_PORT'), '8100');
    assert.equal(root.get('KOWALSKI_DAILY_PORT'), '9000');
    assert.equal(root.get('DATABASE_URL'), server.get('DATABASE_URL'));
    assert.equal(root.get('BETTER_AUTH_URL'), 'http://localhost:8100');
    assert.equal(server.get('PORT'), '8100');
    assert.equal(root.get('BETTER_AUTH_SECRET'), 'keep-this-secret');
    assert.equal(root.get('CUSTOM_SETTING'), 'keep-this-value');
    assert.match(result.project, /^kowalski-wt-[a-f0-9]{12}$/);
  });

  void it('assigns different project and database names to different worktrees', () => {
    const first = worktreeEnv(source, { db: 15432, server: 8100, daily: 9000 }, 'feature/one');
    const second = worktreeEnv(source, { db: 15433, server: 8101, daily: 9001 }, 'feature/two');

    assert.notEqual(first.project, second.project);
    assert.notEqual(envValues(first.root).get('KOWALSKI_DB_NAME'), envValues(second.root).get('KOWALSKI_DB_NAME'));
  });

  void it('keeps an existing checkout identity when its env is regenerated', () => {
    const initial = worktreeEnv(source, { db: 15432, server: 8100, daily: 9000 }, 'feature/one');

    const regenerated = worktreeEnv(
      initial.root,
      { db: 15432, server: 8100, daily: 9000 },
      '/path/to/feature/one',
      true,
    );

    assert.equal(regenerated.project, initial.project);
    assert.equal(envValues(regenerated.root).get('KOWALSKI_DB_NAME'), envValues(initial.root).get('KOWALSKI_DB_NAME'));
  });

  void it('keeps setup overrides in the database URL and Compose project', () => {
    const configured = renderEnv(
      source,
      new Map([
        ['COMPOSE_PROJECT_NAME', 'My Worktree'],
        ['KOWALSKI_DB_NAME', 'My Database'],
        ['KOWALSKI_DB_USER', 'another_user'],
        ['KOWALSKI_DB_PASSWORD', 'another_password'],
      ]),
    );

    const result = worktreeEnv(configured, { db: 15432, server: 8100, daily: 9000 }, 'feature/one', true);
    const values = envValues(result.root);

    assert.equal(result.project, 'my-worktree');
    assert.equal(values.get('KOWALSKI_DB_NAME'), 'my_database');
    assert.equal(values.get('DATABASE_URL'), 'postgresql://another_user:another_password@localhost:15432/my_database');
  });

  void it('replaces the example auth secret with a generated one', () => {
    const result = worktreeEnv(
      source.replace('keep-this-secret', 'secret'),
      { db: 15432, server: 8100, daily: 9000 },
      'feature/one',
    );

    const secret = envValues(result.root).get('BETTER_AUTH_SECRET');

    assert.ok(secret);
    assert.ok(secret.length >= 32);
  });

  void it('rejects a remote database before creating a worktree', () => {
    assert.throws(
      () =>
        worktreeEnv(
          source.replace('localhost:5432', 'db.example.com:5432'),
          { db: 15432, server: 8100, daily: 9000 },
          'feature/one',
        ),
      /DATABASE_URL must use localhost/,
    );
  });

  void it('rejects duplicate keys and invalid ports', () => {
    assert.throws(
      () =>
        renderEnv(
          `${source}BETTER_AUTH_URL=http://localhost:9999\n`,
          new Map([['BETTER_AUTH_URL', 'http://localhost:8100']]),
        ),
      /Duplicate BETTER_AUTH_URL/,
    );
    assert.throws(() => parsePort('99999', 'server'), /Invalid server port/);
  });

  void it('skips a set reserved by another worktree', async () => {
    const ports = await selectPorts(new Set([15432]), async () => true);
    assert.deepEqual(ports, { db: 15433, server: 7001, daily: 7501 });
  });

  void it('skips a set with a listening process', async () => {
    const ports = await selectPorts(new Set(), async port => port !== 7000);
    assert.deepEqual(ports, { db: 15433, server: 7001, daily: 7501 });
  });

  void it('uses the last available set within its dedicated port window', async () => {
    const precedingDatabasePorts = new Set(Array.from({ length: 499 }, (_, offset) => 15432 + offset));
    const ports = await selectPorts(precedingDatabasePorts, async () => true);

    assert.deepEqual(ports, { db: 15931, server: 7499, daily: 7999 });
  });

  void it('rejects an invalid branch before reading env or creating a worktree', () => {
    const script = fileURLToPath(new URL('./create-herdr-worktree.ts', import.meta.url));
    const result = spawnSync(process.execPath, [script, 'bad..branch'], { encoding: 'utf8' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /git check-ref-format failed/);
  });

  void it('uses the main checkout as Herdr parent from a linked worktree', () => {
    const porcelain =
      'worktree /repo/main\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/linked\nHEAD abc\nbranch refs/heads/feature\n';

    assert.equal(mainWorktreePath(porcelain), '/repo/main');
  });
});
