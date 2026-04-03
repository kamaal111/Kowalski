import { vi } from 'vitest';

import { initializeTestLogs } from './logs';

const QUOTES = [
  {
    symbol: 'AAPL',
    shortname: 'Apple Inc.',
    longname: 'Apple Inc.',
    exchange: 'NMS',
    quoteType: 'EQUITY',
    isYahooFinance: true,
  },
];

initializeTestLogs();

vi.mock('yahoo-finance2', () => {
  return {
    default: class YahooFinance {
      search = vi.fn().mockImplementation(async (query: string) => {
        return Promise.resolve({ quotes: QUOTES.filter(quote => quote.symbol.includes(query)) });
      });
      quote = vi.fn().mockResolvedValue({
        symbol: 'AAPL',
        regularMarketPrice: 150.0,
        currency: 'USD',
      });
    },
  };
});
