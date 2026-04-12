import assert from 'node:assert/strict';

import z from 'zod';
import type { SearchResult } from 'yahoo-finance2/modules/search';
import { arrays } from '@kamaalio/kamaal';

import {
  StocksSearchResponseSchema,
  type StocksSearchQuoteItemResponse,
  type StocksSearchResponse,
} from '../schemas/search';

type YahooSearchType = SearchResult['quotes'][number];

type SupportedEquityType = typeof SUPPORTED_EQUITY_TYPES extends Set<infer T> ? T : never;

const SUPPORTED_EQUITY_TYPES = new Set(['EQUITY', 'CURRENCY', 'CRYPTOCURRENCY'] as const);
const SearchQuoteIsinShape = z
  .string()
  .trim()
  .transform(value => (value === '' ? null : value));

export function mapYahooFinanceSearchQuoteToEquitySearchResponse(results: SearchResult): StocksSearchResponse {
  const quotes = arrays.compactMap(results.quotes, mapYahooFinanceQuoteToResponseQuote);

  return StocksSearchResponseSchema.parse({ count: quotes.length, quotes });
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
    isin: getQuoteIsin(quote),
    sector: quote.sector ?? null,
    industry: quote.industry ?? null,
    exchange_dispatch: quote.exchDisp ?? null,
  };
}

function getQuoteIsin(quote: YahooSearchType): string | null {
  const result = SearchQuoteIsinShape.safeParse(quote.isin);
  if (!result.success) {
    return null;
  }

  return result.data;
}

function getQuoteName(quote: YahooSearchType): string | null {
  if (!quote.longname && !quote.shortname) return null;

  const name = quote.longname ?? quote.shortname;
  assert(typeof name === 'string');

  return name;
}

function isSupportedEquityType(quoteType: string): quoteType is SupportedEquityType {
  return SUPPORTED_EQUITY_TYPES.has(quoteType as SupportedEquityType);
}
