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

const yahooFinanceSearchMock: Mock<(query: string) => Promise<SearchResponse>> = vi.fn();

export const yahooFinanceQuoteMock: Mock<(symbols: string | string[]) => Promise<QuoteResponse>> = vi.fn();

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
}

export default class YahooFinanceMock {
  search: typeof yahooFinanceSearchMock = yahooFinanceSearchMock;
  quote: typeof yahooFinanceQuoteMock = yahooFinanceQuoteMock;
}
