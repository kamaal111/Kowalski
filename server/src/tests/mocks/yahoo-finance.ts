import { vi, type Mock } from 'vitest';
import type { ChartMeta, ChartMetaTradingPeriod, ChartResultArrayQuote } from 'yahoo-finance2/modules/chart';
import type { QuoteEquity } from 'yahoo-finance2/modules/quote';
import type { SearchQuoteYahooEquity, SearchResult } from 'yahoo-finance2/modules/search';

import type { YahooFinanceClient } from '../../utils/yahoo-finance.ts';

interface EquityQuoteFixture {
  symbol: string;
  shortname: string;
  longname: string;
  isin?: string;
}

const SEARCH_QUOTE_FIXTURES: EquityQuoteFixture[] = [
  { symbol: 'AAPL', shortname: 'Apple Inc.', longname: 'Apple Inc.', isin: 'US0378331005' },
  { symbol: 'MSFT', shortname: 'Microsoft Corporation', longname: 'Microsoft Corporation' },
];

const DEFAULT_QUOTES_BY_SYMBOL = new Map<string, { symbol: string; regularMarketPrice: number; currency: string }>([
  ['AAPL', { symbol: 'AAPL', regularMarketPrice: 150, currency: 'USD' }],
  ['MSFT', { symbol: 'MSFT', regularMarketPrice: 420.5, currency: 'USD' }],
]);

const DEFAULT_CHART_QUOTES_BY_SYMBOL = new Map<string, { date: Date; close: number }[]>([
  [
    'AAPL',
    [
      { date: new Date('2025-12-18T00:00:00.000Z'), close: 140 },
      { date: new Date('2025-12-19T00:00:00.000Z'), close: 150 },
      { date: new Date('2025-12-22T00:00:00.000Z'), close: 160 },
    ],
  ],
  [
    'MSFT',
    [
      { date: new Date('2025-12-18T00:00:00.000Z'), close: 410 },
      { date: new Date('2025-12-19T00:00:00.000Z'), close: 420 },
      { date: new Date('2025-12-22T00:00:00.000Z'), close: 430 },
    ],
  ],
]);

function buildSearchQuote(fixture: EquityQuoteFixture): SearchQuoteYahooEquity {
  return {
    symbol: fixture.symbol,
    isYahooFinance: true,
    exchange: 'NMS',
    index: 'quotes',
    score: 1,
    quoteType: 'EQUITY',
    typeDisp: 'Equity',
    shortname: fixture.shortname,
    longname: fixture.longname,
    isin: fixture.isin,
  };
}

function buildSearchResult(quotes: SearchQuoteYahooEquity[]): SearchResult {
  return {
    explains: [],
    count: quotes.length,
    quotes,
    news: [],
    nav: [],
    lists: [],
    researchReports: [],
    totalTime: 0,
    timeTakenForQuotes: 0,
    timeTakenForNews: 0,
    timeTakenForAlgowatchlist: 0,
    timeTakenForPredefinedScreener: 0,
    timeTakenForCrunchbase: 0,
    timeTakenForNav: 0,
    timeTakenForResearchReports: 0,
    timeTakenForScreenerField: 0,
    timeTakenForCulturalAssets: 0,
    timeTakenForSearchLists: 0,
  };
}

export function buildQuoteEquity(fixture: {
  symbol: string;
  regularMarketPrice: number;
  currency: string;
}): QuoteEquity {
  return {
    language: 'en-US',
    region: 'US',
    quoteType: 'EQUITY',
    triggerable: true,
    marketState: 'REGULAR',
    tradeable: false,
    exchange: 'NMS',
    exchangeTimezoneName: 'America/New_York',
    exchangeTimezoneShortName: 'EST',
    gmtOffSetMilliseconds: -18000000,
    market: 'us_market',
    esgPopulated: false,
    sourceInterval: 15,
    exchangeDataDelayedBy: 0,
    fullExchangeName: 'NasdaqGS',
    symbol: fixture.symbol,
    currency: fixture.currency,
    regularMarketPrice: fixture.regularMarketPrice,
  };
}

function buildTradingPeriod(): ChartMetaTradingPeriod {
  const start = new Date('2025-12-18T14:30:00.000Z');
  const end = new Date('2025-12-18T21:00:00.000Z');

  return { timezone: 'EST', start, end, gmtoffset: -18000 };
}

export function buildChartMeta(fixture: { symbol: string; currency: string }): ChartMeta {
  const tradingPeriod = buildTradingPeriod();

  return {
    currency: fixture.currency,
    symbol: fixture.symbol,
    exchangeName: 'NMS',
    instrumentType: 'EQUITY',
    firstTradeDate: new Date('2000-01-01T00:00:00.000Z'),
    regularMarketTime: new Date('2025-12-22T21:00:00.000Z'),
    gmtoffset: -18000,
    timezone: 'EST',
    exchangeTimezoneName: 'America/New_York',
    regularMarketPrice: 0,
    priceHint: 2,
    currentTradingPeriod: { pre: tradingPeriod, regular: tradingPeriod, post: tradingPeriod },
    dataGranularity: '1d',
    range: '',
    validRanges: ['1d', '5d', '1mo', '3mo', '6mo', '1y', '2y', '5y', '10y', 'ytd', 'max'],
  };
}

function toDateOnlyString(value: Date | string | number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function buildChartQuote(quote: { date: Date; close: number }): ChartResultArrayQuote {
  return {
    date: quote.date,
    high: null,
    low: null,
    open: null,
    close: quote.close,
    volume: null,
  };
}

const yahooFinanceSearchMock: Mock<YahooFinanceClient['search']> = vi.fn();

export const yahooFinanceQuoteMock: Mock<YahooFinanceClient['quote']> = vi.fn();
export const yahooFinanceChartMock: Mock<YahooFinanceClient['chart']> = vi.fn();

export function resetYahooFinanceMocks() {
  yahooFinanceSearchMock.mockReset();
  yahooFinanceSearchMock.mockImplementation(async query => {
    const quotes = SEARCH_QUOTE_FIXTURES.filter(fixture => fixture.symbol.includes(query)).map(buildSearchQuote);

    return buildSearchResult(quotes);
  });

  yahooFinanceQuoteMock.mockReset();
  yahooFinanceQuoteMock.mockImplementation(async symbols =>
    symbols.flatMap(symbol => {
      const fixture = DEFAULT_QUOTES_BY_SYMBOL.get(symbol);

      return fixture == null ? [] : [buildQuoteEquity(fixture)];
    }),
  );

  yahooFinanceChartMock.mockReset();
  yahooFinanceChartMock.mockImplementation(async (symbol, options) => {
    const period1 = toDateOnlyString(options.period1);
    const period2 = options.period2 == null ? null : toDateOnlyString(options.period2);
    const quotes = (DEFAULT_CHART_QUOTES_BY_SYMBOL.get(symbol) ?? [])
      .filter(quote => quote.date.toISOString().slice(0, 10) >= period1)
      .filter(quote => period2 == null || quote.date.toISOString().slice(0, 10) < period2)
      .map(buildChartQuote);

    return {
      meta: buildChartMeta({ symbol, currency: 'USD' }),
      quotes,
    };
  });
}

export default class YahooFinanceMock implements YahooFinanceClient {
  search: typeof yahooFinanceSearchMock = yahooFinanceSearchMock;
  quote: typeof yahooFinanceQuoteMock = yahooFinanceQuoteMock;
  chart: typeof yahooFinanceChartMock = yahooFinanceChartMock;
}
