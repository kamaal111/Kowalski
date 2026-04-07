import childProcess from 'node:child_process';
import fs from 'node:fs/promises';
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

describe('Logging policy', () => {
  afterEach(() => {
    resetRootLogger();
  });

  test('rejects console usage in server source and allows it in scripts', async () => {
    const fixtureId = crypto.randomUUID();
    const sourceFilePath = path.join(REPO_ROOT, 'server/src/tests', `logging-policy-${fixtureId}.ts`);
    const scriptFilePath = path.join(REPO_ROOT, 'server/scripts', `logging-policy-${fixtureId}.ts`);

    await Promise.all([
      fs.writeFile(sourceFilePath, "console.log('src');\n", 'utf8'),
      fs.writeFile(scriptFilePath, "console.error('script');\n", 'utf8'),
    ]);

    try {
      const sourceResult = runOxlint(sourceFilePath);
      const scriptResult = runOxlint(scriptFilePath);

      expect(sourceResult.error).toBeUndefined();
      expect(sourceResult.status).toBe(1);
      expect(getLintOutput(sourceResult)).toContain('no-console');

      expect(scriptResult.error).toBeUndefined();
      expect(scriptResult.status).toBe(0);
      expect(getLintOutput(scriptResult)).not.toContain('no-console');
    } finally {
      await Promise.all([fs.rm(sourceFilePath, { force: true }), fs.rm(scriptFilePath, { force: true })]);
    }
  });

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

function runOxlint(filePath: string) {
  return childProcess.spawnSync('pnpm', ['exec', 'oxlint', '-c', OXLINT_CONFIG, filePath], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });
}

function getLintOutput(result: { stdout: string; stderr: string }): string {
  return `${result.stdout}${result.stderr}`;
}
