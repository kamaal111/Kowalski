import type { SearchResult } from 'yahoo-finance2/modules/search';
import { arrays, asserts } from '@kamaalio/kamaal';

import type { StocksSearchQuoteItemResponse, StocksSearchResponse } from '../schemas/search.js';

type YahooSearchType = SearchResult['quotes'][number];

type SupportedEquityType = typeof SUPPORTED_EQUITY_TYPES extends Set<infer T> ? T : never;

const SUPPORTED_EQUITY_TYPES = new Set(['EQUITY', 'CURRENCY', 'CRYPTOCURRENCY'] as const);

export function mapYahooFinanceSearchQuoteToEquitySearchResponse(results: SearchResult): StocksSearchResponse {
  const quotes = arrays.compactMap(results.quotes, mapYahooFinanceQuoteToResponseQuote);

  return { count: quotes.length, quotes };
}

function mapYahooFinanceQuoteToResponseQuote(quote: YahooSearchType): StocksSearchQuoteItemResponse | null {
  if (!quote.isYahooFinance) return null;
  if (!isSupportedEquityType(quote.quoteType)) return null;

  const name = getQuoteName(quote);
  if (name == null) return null;

  return {
    name,
    symbol: quote.symbol,
    exchange: quote.exchange,
    sector: quote.sector ?? null,
    industry: quote.industry ?? null,
    exchange_dispatch: quote.exchDisp ?? null,
  };
}

function getQuoteName(quote: YahooSearchType): string | null {
  if (!quote.longname && !quote.shortname) return null;

  const name = quote.longname ?? quote.shortname;
  asserts.invariant(typeof name === 'string');

  return name;
}

function isSupportedEquityType(quoteType: string): quoteType is SupportedEquityType {
  return SUPPORTED_EQUITY_TYPES.has(quoteType as SupportedEquityType);
}
