import { describe, expect, it } from 'vitest';

import { createSyntheticTickerId, createSyntheticTickerIsin, parseSyntheticTickerId } from './tickers';

describe('ticker utils', () => {
  it('creates a normalized synthetic ticker id', () => {
    expect(createSyntheticTickerId('nasdaq gs', 'brk.b')).toBe('portfolio-stock:NASDAQ-GS:BRK-B');
  });

  it('creates a normalized synthetic ticker isin', () => {
    expect(createSyntheticTickerIsin('nyse', 'rds/a')).toBe('PORTFOLIO-NYSE-RDS-A');
  });

  it('parses a synthetic ticker id', () => {
    expect(parseSyntheticTickerId('portfolio-stock:NASDAQ-GS:BRK-B')).toEqual({
      exchange: 'NASDAQ-GS',
      symbol: 'BRK-B',
    });
  });

  it('returns null for malformed synthetic ticker ids', () => {
    expect(parseSyntheticTickerId('portfolio-stock::AAPL')).toBeNull();
  });
});
