import type { QuoteResponseArray } from 'yahoo-finance2/modules/quote';
import z from 'zod';

import type { HonoContext } from '@/api/contexts';
import { logError, logWarn } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import yahooFinance from '@/utils/yahoo-finance';

const YahooQuoteSchema = z
  .object({
    symbol: z.string().min(1),
    currency: z.string().length(3),
    regularMarketPrice: z.number().positive(),
  })
  .loose();

interface YahooQuote {
  currency: string;
  price: number;
}

export async function fetchYahooQuotes(c: HonoContext, symbols: string[]): Promise<Map<string, YahooQuote>> {
  if (symbols.length === 0) {
    return new Map();
  }

  let quotes: QuoteResponseArray;
  try {
    quotes = await yahooFinance.quote(symbols, {
      fields: ['symbol', 'regularMarketPrice', 'currency'],
    });
  } catch (error) {
    logError(
      withRequestLogger(c, { component: 'portfolio' }),
      {
        event: 'portfolio.stock_prices.yahoo.failed',
        quote_symbols: symbols,
        outcome: 'failure',
      },
      error,
    );

    return new Map();
  }

  const resolvedQuotes = quotes.reduce((acc, quote) => {
    const parsedQuote = YahooQuoteSchema.safeParse(quote);
    if (!parsedQuote.success) {
      return acc;
    }

    return acc.set(parsedQuote.data.symbol, {
      currency: parsedQuote.data.currency,
      price: parsedQuote.data.regularMarketPrice,
    });
  }, new Map<string, YahooQuote>());

  const unresolvedSymbols = symbols.filter(symbol => !resolvedQuotes.has(symbol));
  if (unresolvedSymbols.length > 0) {
    logWarn(withRequestLogger(c, { component: 'portfolio' }), {
      event: 'portfolio.stock_prices.yahoo.partial',
      quote_symbols: symbols,
      missing_symbols: unresolvedSymbols,
      outcome: 'failure',
    });
  }

  return resolvedQuotes;
}
