import path from 'node:path';

import { ESLint } from 'eslint';
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

describe('Logging policy', () => {
  afterEach(() => {
    resetRootLogger();
  });

  test('rejects console usage in server source and scripts', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [sourceResults, scriptResults] = await Promise.all([
      eslint.lintText("console.log('src');", {
        filePath: path.join(REPO_ROOT, 'server/src/tests/integration.test.ts'),
      }),
      eslint.lintText("console.error('script');", {
        filePath: path.join(REPO_ROOT, 'server/scripts/download-openapi-spec.ts'),
      }),
    ]);
    const sourceResult = sourceResults[0];
    const scriptResult = scriptResults[0];

    expect(sourceResult.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'no-console',
          severity: 2,
        }),
      ]),
    );
    expect(scriptResult.messages).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: 'no-console',
          severity: 2,
        }),
      ]),
    );
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
