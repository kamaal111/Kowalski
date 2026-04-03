import { describe, expect, it } from 'vitest';

import { dateOnlyStringToISO8601String, parseDateOnlyStringAsUTC } from './dates';

describe('dates utils', () => {
  describe('parseDateOnlyStringAsUTC', () => {
    it('parses a date-only string as midnight UTC', () => {
      const date = parseDateOnlyStringAsUTC('2026-04-03');

      expect(date.toISOString()).toBe('2026-04-03T00:00:00.000Z');
    });

    it('throws for malformed date-only strings', () => {
      expect(() => parseDateOnlyStringAsUTC('2026/04/03')).toThrow('Invalid date-only string');
    });

    it('throws for impossible calendar dates', () => {
      expect(() => parseDateOnlyStringAsUTC('2026-02-30')).toThrow('Invalid date-only string');
    });
  });

  describe('dateOnlyStringToISO8601String', () => {
    it('returns the ISO8601 representation at midnight UTC', () => {
      expect(dateOnlyStringToISO8601String('2026-04-03')).toBe('2026-04-03T00:00:00.000Z');
    });
  });
});
