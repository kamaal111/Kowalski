import type { ChartResultArray } from 'yahoo-finance2/modules/chart';
import z from 'zod';

import type { HonoContext } from '../../api/contexts.ts';
import { CurrencySchema, type Currency } from '../../forex/constants.ts';
import { withRequestLogger } from '../../logging/http.ts';
import { logError, logWarn } from '../../logging/index.ts';
import { yahooFinanceClient } from '../../utils/yahoo-finance.ts';
import { DATE_FORMAT, YAHOO_CHART_TIMEOUT_MS } from '../constants.ts';

const YahooChartQuoteSchema = z
  .object({
    date: z.date(),
    close: z.number().positive().nullable(),
  })
  .loose();

const YahooChartSchema = z
  .object({
    meta: z
      .object({
        currency: CurrencySchema,
        symbol: z.string().min(1),
      })
      .loose(),
    quotes: z.array(YahooChartQuoteSchema),
  })
  .loose();

interface YahooChartPrice {
  currency: Currency;
  date: string;
  price: number;
}

type YahooChartResult = { success: false } | { success: true; prices: YahooChartPrice[]; missingDates: string[] };

export async function fetchYahooChartPrices(
  c: HonoContext,
  {
    symbol,
    period1,
    period2,
  }: {
    symbol: string;
    period1: string;
    period2: string;
  },
): Promise<YahooChartResult> {
  let chartResult: ChartResultArray;

  try {
    chartResult = await yahooFinanceClient.chart(
      symbol,
      {
        period1,
        period2,
        interval: '1d',
        return: 'array',
      },
      { fetchOptions: { signal: AbortSignal.timeout(YAHOO_CHART_TIMEOUT_MS) } },
    );
  } catch (error) {
    logError(
      withRequestLogger(c, { component: 'portfolio' }),
      {
        event: 'portfolio.stock_prices.yahoo_chart.failed',
        quote_symbol: symbol,
        period_start: period1,
        period_end: period2,
        outcome: 'failure',
      },
      error,
    );

    return { success: false };
  }

  const parsedChart = YahooChartSchema.safeParse(chartResult);

  if (!parsedChart.success || parsedChart.data.meta.symbol !== symbol) {
    logWarn(withRequestLogger(c, { component: 'portfolio' }), {
      event: 'portfolio.stock_prices.yahoo_chart.invalid',
      quote_symbol: symbol,
      period_start: period1,
      period_end: period2,
      outcome: 'failure',
    });

    return { success: false };
  }

  const prices = new Map<string, YahooChartPrice>();
  const missingDates = new Set<string>();

  for (const quote of parsedChart.data.quotes) {
    const date = quote.date.toISOString().slice(0, DATE_FORMAT.length);

    if (date < period1 || date >= period2) {
      continue;
    }

    if (quote.close == null) {
      missingDates.add(date);
    } else {
      prices.set(date, { currency: parsedChart.data.meta.currency, date, price: quote.close });
    }
  }

  return {
    success: true,
    prices: prices.values().toArray(),
    missingDates: missingDates
      .values()
      .filter(date => !prices.has(date))
      .toArray()
      .toSorted(),
  };
}
