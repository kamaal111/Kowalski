import type {
  SearchQuoteNonYahoo,
  SearchQuoteYahooCryptocurrency,
  SearchQuoteYahooCurrency,
  SearchQuoteYahooEquity,
  SearchQuoteYahooETF,
  SearchQuoteYahooFund,
  SearchQuoteYahooFuture,
  SearchQuoteYahooIndex,
  SearchQuoteYahooMoneyMarket,
  SearchQuoteYahooOption,
  SearchResult,
} from 'yahoo-finance2/modules/search';
import { arrays, asserts } from '@kamaalio/kamaal';

import type { StocksSearchQuoteItemResponse, StocksSearchResponse } from '../schemas/search.js';

type YahooSearchType =
  | SearchQuoteYahooEquity
  | SearchQuoteYahooOption
  | SearchQuoteYahooETF
  | SearchQuoteYahooFund
  | SearchQuoteYahooIndex
  | SearchQuoteYahooCurrency
  | SearchQuoteYahooCryptocurrency
  | SearchQuoteNonYahoo
  | SearchQuoteYahooFuture
  | SearchQuoteYahooMoneyMarket;

export function mapYahooFinanceSearchQuoteToEquitySearchResponse(results: SearchResult): StocksSearchResponse {
  const equityQuotes = arrays.compactMap(results.quotes, mapYahooFinanceQuoteToResponseQuote);

  return { count: equityQuotes.length, quotes: equityQuotes };
}

function mapYahooFinanceQuoteToResponseQuote(quote: YahooSearchType): StocksSearchQuoteItemResponse | null {
  if (quote.quoteType !== 'EQUITY') return null;

  const equityQuote = quote as SearchQuoteYahooEquity;
  if (!equityQuote.longname && !equityQuote.shortname) return null;

  const name = equityQuote.longname ?? equityQuote.shortname;
  asserts.invariant(name != null);

  return {
    name,
    symbol: equityQuote.symbol,
    exchange: equityQuote.exchange,
    sector: equityQuote.sector ?? null,
    industry: equityQuote.industry ?? null,
    exchange_dispatch: equityQuote.exchDisp ?? null,
  };
}
