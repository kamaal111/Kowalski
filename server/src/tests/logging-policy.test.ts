import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
  createMemoryLogDestination,
  getComponentLogger,
  logError,
  logInfo,
  resetRootLogger,
  setRootLoggerDestination,
} from '@/logging';

const REPO_ROOT = path.resolve(import.meta.dirname, '../../..');
const OXLINT_CONFIG = path.join(REPO_ROOT, '.oxlintrc.json');
const OXLINT_BIN_DIRECTORY = path.join(REPO_ROOT, 'node_modules/.bin');

describe('Logging policy', () => {
  afterEach(() => {
    resetRootLogger();
  });

  test('rejects console usage in server source and allows it in scripts', async () => {
    const fixtureId = crypto.randomUUID();
    const fixtureRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'logging-policy-'));
    const sourceRelativeFilePath = path.join('server/src/tests', `logging-policy-${fixtureId}.ts`);
    const scriptRelativeFilePath = path.join('server/scripts', `logging-policy-${fixtureId}.ts`);
    const sourceFilePath = path.join(fixtureRoot, sourceRelativeFilePath);
    const scriptFilePath = path.join(fixtureRoot, scriptRelativeFilePath);
    const oxlintConfigPath = path.join(fixtureRoot, '.oxlintrc.json');

    await Promise.all([
      fs.mkdir(path.dirname(sourceFilePath), { recursive: true }),
      fs.mkdir(path.dirname(scriptFilePath), { recursive: true }),
      writeOxlintConfig(oxlintConfigPath),
    ]);
    await Promise.all([
      fs.writeFile(sourceFilePath, "console.log('src');\n", 'utf8'),
      fs.writeFile(scriptFilePath, "console.error('script');\n", 'utf8'),
    ]);

    try {
      const sourceResult = runOxlint(fixtureRoot, oxlintConfigPath, sourceRelativeFilePath);
      const scriptResult = runOxlint(fixtureRoot, oxlintConfigPath, scriptRelativeFilePath);

      expect(sourceResult.error).toBeUndefined();
      expect(sourceResult.status).toBe(1);
      expect(getLintOutput(sourceResult)).toContain('no-console');

      expect(scriptResult.error).toBeUndefined();
      expect(scriptResult.status).toBe(0);
      expect(getLintOutput(scriptResult)).not.toContain('no-console');
    } finally {
      await fs.rm(fixtureRoot, { recursive: true, force: true });
    }
  }, 15000);

  test('emits flat structured logs only', () => {
    const logs: string[] = [];
    setRootLoggerDestination(createMemoryLogDestination(logs));
    const logger = getComponentLogger('logging-test');

    logInfo(logger, {
      event: 'logging.flatness.checked',
      primitive_list: ['one', 'two'],
    });
    logError(logger, { event: 'logging.error.flatness.checked' }, new Error('boom'));

    const structuredLogs = logs
      .flatMap(chunk => chunk.split('\n'))
      .filter(line => line.trim().length > 0)
      .map(line => parseJsonLogLine(line))
      .filter(isStructuredLogRecord);

    expect(structuredLogs).toHaveLength(2);

    for (const log of structuredLogs) {
      for (const key of Object.keys(log)) {
        expect(key).toBe(key.toLowerCase());
      }

      for (const value of Object.values(log)) {
        const isPrimitive =
          value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
        const isPrimitiveArray =
          Array.isArray(value) &&
          value.every(item => item == null || ['string', 'number', 'boolean'].includes(typeof item));

        expect(isPrimitive || isPrimitiveArray).toBe(true);
      }
    }
    expect(structuredLogs[0]).toMatchObject({
      event: 'logging.flatness.checked',
      primitive_list: ['one', 'two'],
    });
    expect(structuredLogs[1]).toMatchObject({
      event: 'logging.error.flatness.checked',
      error_name: 'Error',
      error_message: 'boom',
    });
    expect(structuredLogs[1]).not.toHaveProperty('err');
  });
});

function isStructuredLogRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function parseJsonLogLine(line: string): unknown {
  return JSON.parse(line);
}

async function writeOxlintConfig(configFilePath: string) {
  const parsedConfig: unknown = JSON.parse(await fs.readFile(OXLINT_CONFIG, 'utf8'));
  const config = isStructuredLogRecord(parsedConfig) ? parsedConfig : {};
  const options = isStructuredLogRecord(config.options) ? config.options : {};

  await fs.writeFile(
    configFilePath,
    `${JSON.stringify({ ...config, options: { ...options, typeAware: false } })}\n`,
    'utf8',
  );
}

function runOxlint(rootDirectory: string, configFilePath: string, filePath: string) {
  const relativeConfigFilePath = path.relative(rootDirectory, configFilePath);

  return childProcess.spawnSync('oxlint', ['-c', relativeConfigFilePath, filePath], {
    cwd: rootDirectory,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${OXLINT_BIN_DIRECTORY}${path.delimiter}${process.env.PATH ?? ''}`,
    },
  });
}

function getLintOutput(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}${result.stderr}`;
}
