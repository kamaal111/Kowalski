#!/usr/bin/env node

import path from 'node:path';

import {
  availablePorts,
  envValues,
  parsePort,
  readOptional,
  renderEnv,
  reservedPorts,
  worktreeEnv,
  writeWorktreeEnv,
} from '../../../../scripts/worktree-env.ts';

async function main(): Promise<void> {
  const checkout = process.cwd();
  const existing = await readOptional(path.join(checkout, '.env'));
  const example = existing === undefined ? await readOptional(path.join(checkout, '.env.example')) : undefined;

  if (existing === undefined && example === undefined) {
    throw new Error('Create .env from .env.example before setting up a worktree');
  }

  const databaseUrl = example === undefined ? undefined : envValues(example).get('DATABASE_URL');

  if (existing === undefined && databaseUrl === undefined) {
    throw new Error('DATABASE_URL is required in .env.example');
  }

  const source = existing ?? `DATABASE_URL=${databaseUrl}\n`;

  const args = process.argv.slice(2);
  const overrides = new Map<string, string>();

  const flags = new Map([
    ['--auth-secret', 'BETTER_AUTH_SECRET'],
    ['--compose-project', 'COMPOSE_PROJECT_NAME'],
    ['--db-name', 'KOWALSKI_DB_NAME'],
    ['--db-password', 'KOWALSKI_DB_PASSWORD'],
    ['--db-port', 'KOWALSKI_DB_PORT'],
    ['--db-user', 'KOWALSKI_DB_USER'],
    ['--server-port', 'KOWALSKI_SERVER_PORT'],
    ['--daily-port', 'KOWALSKI_DAILY_PORT'],
  ]);

  for (let index = 0; index < args.length; index += 2) {
    const key = flags.get(args[index] ?? '');
    const value = args[index + 1];

    if (key === undefined || value === undefined) {
      throw new Error(`Invalid argument: ${args[index] ?? ''}`);
    }

    overrides.set(key, value);
  }

  const configuredSource = renderEnv(source, overrides);
  const values = envValues(configuredSource);
  const suggested = await availablePorts(checkout);

  const ports = {
    db: parsePort(
      overrides.get('KOWALSKI_DB_PORT') ?? values.get('KOWALSKI_DB_PORT') ?? String(suggested.db),
      'database',
    ),
    server: parsePort(
      overrides.get('KOWALSKI_SERVER_PORT') ?? values.get('KOWALSKI_SERVER_PORT') ?? String(suggested.server),
      'server',
    ),
    daily: parsePort(
      overrides.get('KOWALSKI_DAILY_PORT') ?? values.get('KOWALSKI_DAILY_PORT') ?? String(suggested.daily),
      'daily',
    ),
  };

  const otherPorts = await reservedPorts(checkout, checkout);

  if (Object.values(ports).some(port => otherPorts.has(port)) || new Set(Object.values(ports)).size !== 3) {
    throw new Error('Selected ports conflict with another worktree or each other');
  }

  const contents = worktreeEnv(configuredSource, ports, checkout, true);

  await writeWorktreeEnv(checkout, contents, false);

  console.log(
    `Configured ${checkout}: database ${ports.db}, server ${ports.server}, daily ${ports.daily}, Compose ${contents.project}`,
  );
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
