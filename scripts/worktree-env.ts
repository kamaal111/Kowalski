import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

interface WorktreePorts {
  db: number;
  server: number;
  daily: number;
}

interface WorktreeEnvironment {
  root: string;
  server: string;
  project: string;
}

const DEFAULT_PORTS: WorktreePorts = { db: 5432, server: 8082, daily: 8081 };

const PORT_KEYS = ['KOWALSKI_DB_PORT', 'KOWALSKI_SERVER_PORT', 'KOWALSKI_DAILY_PORT'] as const;

export function envValues(source: string): Map<string, string> {
  return source.split(/\r?\n/).reduce((values, line) => {
    const [_, key, value] = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line) ?? [];

    if (key === undefined || value === undefined) {
      return values;
    }

    if (values.has(key)) {
      throw new Error(`Duplicate ${key} in .env`);
    }

    return values.set(key, value);
  }, new Map<string, string>());
}

export function renderEnv(source: string, replacements: Map<string, string>): string {
  const seen = new Set<string>();

  const lines = (source.length === 0 ? [] : source.replace(/\r?\n$/, '').split(/\r?\n/)).map(line => {
    const key = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1];

    if (key === undefined || !replacements.has(key)) {
      return line;
    }

    if (seen.has(key)) {
      throw new Error(`Duplicate ${key} in .env`);
    }

    seen.add(key);

    return `${key}=${replacements.get(key)}`;
  });

  for (const [key, value] of replacements) {
    if (!seen.has(key)) {
      lines.push(`${key}=${value}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function mainWorktreePath(porcelain: string): string {
  const checkout = porcelain.split('\n').find(line => line.startsWith('worktree '));

  if (checkout === undefined) {
    throw new Error('Main worktree was not found');
  }

  return checkout.slice('worktree '.length);
}

export function worktreePaths(repoRoot: string): string[] {
  return execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length));
}

export async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }

    throw error;
  }
}

export function parsePort(value: string, label: string): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 1000 || port > 65535) {
    throw new Error(`Invalid ${label} port: ${value}`);
  }

  return port;
}

export async function reservedPorts(repoRoot: string, excludePath?: string): Promise<Set<number>> {
  return (
    await Promise.all(
      worktreePaths(repoRoot).map(async checkout => {
        if (checkout === excludePath) {
          return null;
        }

        const source = await readOptional(path.join(checkout, '.env'));

        return [checkout, source] as const;
      }),
    )
  ).reduce<Set<number>>((reserved, pair) => {
    if (pair == null) {
      return reserved;
    }

    const [, source] = pair;
    const values = source === undefined ? new Map<string, string>() : envValues(source);

    const ports = [
      parsePort(values.get(PORT_KEYS[0]) ?? String(DEFAULT_PORTS.db), 'database'),
      parsePort(values.get(PORT_KEYS[1]) ?? String(DEFAULT_PORTS.server), 'server'),
      parsePort(values.get(PORT_KEYS[2]) ?? String(DEFAULT_PORTS.daily), 'daily'),
    ];

    for (const port of ports) {
      reserved.add(port);
    }

    return reserved;
  }, new Set<number>());
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

export async function availablePorts(repoRoot: string): Promise<WorktreePorts> {
  const reserved = await reservedPorts(repoRoot);

  return selectPorts(reserved, portIsFree);
}

export async function selectPorts(
  reserved: ReadonlySet<number>,
  isFree: (port: number) => Promise<boolean>,
): Promise<WorktreePorts> {
  for (let offset = 0; offset < 500; offset += 1) {
    const ports = { db: 15432 + offset, server: 7000 + offset, daily: 7500 + offset };
    const candidates = Object.values(ports);

    if (candidates.some(port => reserved.has(port))) {
      continue;
    }

    if ((await Promise.all(candidates.map(isFree))).every(Boolean)) {
      return ports;
    }
  }

  throw new Error('No free port set available for a new worktree');
}

export function worktreeEnv(
  source: string,
  ports: WorktreePorts,
  identity: string,
  preserveIdentity = false,
): WorktreeEnvironment {
  const values = envValues(source);
  const rawDatabaseUrl = values.get('DATABASE_URL');

  if (rawDatabaseUrl === undefined) {
    throw new Error('DATABASE_URL is required in .env');
  }

  const databaseUrl = new URL(rawDatabaseUrl);

  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname)) {
    throw new Error('DATABASE_URL must use localhost for per-worktree port allocation');
  }

  const hash = createHash('sha256').update(identity).digest('hex').slice(0, 12);

  const project = preserveIdentity
    ? sanitizeComposeName(values.get('COMPOSE_PROJECT_NAME') ?? `kowalski-wt-${hash}`)
    : `kowalski-wt-${hash}`;

  const dbName = preserveIdentity
    ? sanitizeDatabaseName(values.get('KOWALSKI_DB_NAME') ?? `kowalski_${hash}`)
    : `kowalski_${hash}`;

  const dbUser = values.get('KOWALSKI_DB_USER') ?? decodeURIComponent(databaseUrl.username || 'kowalski_user');

  const dbPassword =
    values.get('KOWALSKI_DB_PASSWORD') ?? decodeURIComponent(databaseUrl.password || 'kowalski_password');

  const configuredSecret = values.get('BETTER_AUTH_SECRET');

  const secret =
    configuredSecret === undefined || configuredSecret === 'secret'
      ? randomBytes(32).toString('base64url')
      : configuredSecret;

  databaseUrl.port = String(ports.db);
  databaseUrl.username = dbUser;
  databaseUrl.password = dbPassword;
  databaseUrl.pathname = `/${dbName}`;
  const authUrl = `http://localhost:${ports.server}`;

  const root = renderEnv(
    source,
    new Map([
      ['COMPOSE_PROJECT_NAME', project],
      ['KOWALSKI_DB_HOST', 'localhost'],
      ['KOWALSKI_DB_PORT', String(ports.db)],
      ['KOWALSKI_DB_NAME', dbName],
      ['KOWALSKI_DB_USER', dbUser],
      ['KOWALSKI_DB_PASSWORD', dbPassword],
      ['KOWALSKI_SERVER_PORT', String(ports.server)],
      ['KOWALSKI_DAILY_PORT', String(ports.daily)],
      ['DATABASE_URL', databaseUrl.toString()],
      ['BETTER_AUTH_SECRET', secret],
      ['BETTER_AUTH_URL', authUrl],
    ]),
  );

  const server = renderEnv(
    '',
    new Map([
      ['DATABASE_URL', databaseUrl.toString()],
      ['BETTER_AUTH_SECRET', secret],
      ['BETTER_AUTH_URL', authUrl],
      ['PORT', String(ports.server)],
    ]),
  );

  return { root, server, project };
}

function sanitizeComposeName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (sanitized.length === 0) {
    throw new Error('Compose project name must contain letters or digits');
  }

  return sanitized;
}

function sanitizeDatabaseName(value: string): string {
  const sanitized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (sanitized.length === 0) {
    throw new Error('Database name must contain letters or digits');
  }

  return sanitized.slice(0, 63);
}

export async function writeWorktreeEnv(
  checkout: string,
  contents: { root: string; server: string },
  exclusive: boolean,
): Promise<void> {
  const flag = exclusive ? 'wx' : 'w';
  await fs.writeFile(path.join(checkout, '.env'), contents.root, { flag, mode: 0o600 });
  await fs.writeFile(path.join(checkout, 'server', '.env'), contents.server, { flag, mode: 0o600 });
}
