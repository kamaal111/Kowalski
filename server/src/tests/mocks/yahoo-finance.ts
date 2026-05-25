import { vi, type Mock } from 'vitest';

const SEARCH_QUOTES = [
  {
    symbol: 'AAPL',
    shortname: 'Apple Inc.',
    longname: 'Apple Inc.',
    exchange: 'NMS',
    isin: 'US0378331005',
    quoteType: 'EQUITY',
    isYahooFinance: true,
  },
  {
    symbol: 'MSFT',
    shortname: 'Microsoft Corporation',
    longname: 'Microsoft Corporation',
    exchange: 'NMS',
    quoteType: 'EQUITY',
    isYahooFinance: true,
  },
];

const DEFAULT_QUOTES_BY_SYMBOL: Record<string, { symbol: string; regularMarketPrice: number; currency: string }> = {
  AAPL: {
    symbol: 'AAPL',
    regularMarketPrice: 150,
    currency: 'USD',
  },
  MSFT: {
    symbol: 'MSFT',
    regularMarketPrice: 420.5,
    currency: 'USD',
  },
};

const DEFAULT_CHART_QUOTES_BY_SYMBOL: Record<string, { date: Date; close: number }[]> = {
  AAPL: [
    { date: new Date('2025-12-18T00:00:00.000Z'), close: 140 },
    { date: new Date('2025-12-19T00:00:00.000Z'), close: 150 },
    { date: new Date('2025-12-22T00:00:00.000Z'), close: 160 },
  ],
  MSFT: [
    { date: new Date('2025-12-18T00:00:00.000Z'), close: 410 },
    { date: new Date('2025-12-19T00:00:00.000Z'), close: 420 },
    { date: new Date('2025-12-22T00:00:00.000Z'), close: 430 },
  ],
};

interface SearchResponse {
  quotes: typeof SEARCH_QUOTES;
}

type QuoteResponse =
  | {
      symbol: string;
      regularMarketPrice: number;
      currency: string;
    }
  | {
      symbol: string;
      regularMarketPrice: number;
      currency: string;
    }[]
  | null;

interface ChartResponse {
  meta: {
    currency: string;
  };
  quotes: {
    date: Date;
    close: number;
    high: number | null;
    low: number | null;
    open: number | null;
    volume: number | null;
  }[];
}

const yahooFinanceSearchMock: Mock<(query: string) => Promise<SearchResponse>> = vi.fn();

export const yahooFinanceQuoteMock: Mock<(symbols: string | string[]) => Promise<QuoteResponse>> = vi.fn();
export const yahooFinanceChartMock: Mock<
  (
    symbol: string,
    options: { period1: string; period2: string; interval: string; return: string },
  ) => Promise<ChartResponse>
> = vi.fn();

export function resetYahooFinanceMocks() {
  yahooFinanceSearchMock.mockReset();
  yahooFinanceSearchMock.mockImplementation(async (query: string) => ({
    quotes: SEARCH_QUOTES.filter(quote => quote.symbol.includes(query)),
  }));

  yahooFinanceQuoteMock.mockReset();
  yahooFinanceQuoteMock.mockImplementation(async (symbols: string | string[]) => {
    const symbolList = Array.isArray(symbols) ? symbols : [symbols];
    const quotes = symbolList.flatMap(symbol => {
      const quote = DEFAULT_QUOTES_BY_SYMBOL[symbol];

      return quote == null ? [] : [quote];
    });

    return Array.isArray(symbols) ? quotes : (quotes[0] ?? null);
  });

  yahooFinanceChartMock.mockReset();
  yahooFinanceChartMock.mockImplementation(async (symbol: string, options) => ({
    meta: {
      currency: 'USD',
    },
    quotes: (DEFAULT_CHART_QUOTES_BY_SYMBOL[symbol] ?? [])
      .filter(quote => quote.date.toISOString().slice(0, 10) >= options.period1)
      .filter(quote => quote.date.toISOString().slice(0, 10) < options.period2)
      .map(quote => ({
        date: quote.date,
        close: quote.close,
        high: null,
        low: null,
        open: null,
        volume: null,
      })),
  }));
}

export default class YahooFinanceMock {
  search: typeof yahooFinanceSearchMock = yahooFinanceSearchMock;
  quote: typeof yahooFinanceQuoteMock = yahooFinanceQuoteMock;
  chart: typeof yahooFinanceChartMock = yahooFinanceChartMock;
}
