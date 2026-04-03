import { describe, expect, it } from 'vitest';

import { createSyntheticTickerId, createSyntheticTickerIsin } from './tickers';

describe('ticker utils', () => {
  it('creates a normalized synthetic ticker id', () => {
    expect(createSyntheticTickerId('nasdaq gs', 'brk.b')).toBe('portfolio-stock:NASDAQ-GS:BRK-B');
  });

  it('creates a normalized synthetic ticker isin', () => {
    expect(createSyntheticTickerIsin('nyse', 'rds/a')).toBe('PORTFOLIO-NYSE-RDS-A');
  });
});
