import { afterEach, describe, expect, test } from 'vitest';

import { parseJsonRecord } from './json.ts';
import {
  createMemoryLogDestination,
  getComponentLogger,
  logError,
  logInfo,
  resetRootLogger,
  setRootLoggerDestination,
} from '../logging/index.ts';
import { isPrimitiveLogValue } from '../utils/type-guards.ts';

describe('Logging policy', () => {
  afterEach(() => {
    resetRootLogger();
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
      .flatMap(line => {
        const log = parseJsonRecord(line);

        return log == null ? [] : [log];
      });

    expect(structuredLogs).toHaveLength(2);

    for (const log of structuredLogs) {
      for (const key of Object.keys(log)) {
        expect(key).toBe(key.toLowerCase());
      }

      for (const value of Object.values(log)) {
        const isPrimitive = value == null || isPrimitiveLogValue(value);
        const isPrimitiveArray = Array.isArray(value) && value.every(item => item == null || isPrimitiveLogValue(item));

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
