import type { ChartResultArray } from 'yahoo-finance2/modules/chart';
import z from 'zod';

import type { HonoContext } from '@/api/contexts';
import { CurrencyShape, type Currency } from '@/forex/constants';
import { logError, logWarn } from '@/logging';
import { withRequestLogger } from '@/logging/http';
import yahooFinance from '@/utils/yahoo-finance';
import { DATE_SHAPE } from '../constants';

const YahooChartQuoteSchema = z
  .object({
    date: z.date(),
    close: z.number().positive(),
  })
  .loose();

const YahooChartSchema = z
  .object({
    meta: z
      .object({
        currency: CurrencyShape,
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
): Promise<YahooChartPrice[]> {
  let chartResult: ChartResultArray;
  try {
    chartResult = await yahooFinance.chart(symbol, {
      period1,
      period2,
      interval: '1d',
      return: 'array',
    });
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

    return [];
  }

  const parsedChart = YahooChartSchema.safeParse(chartResult);
  if (!parsedChart.success) {
    logWarn(withRequestLogger(c, { component: 'portfolio' }), {
      event: 'portfolio.stock_prices.yahoo_chart.invalid',
      quote_symbol: symbol,
      period_start: period1,
      period_end: period2,
      outcome: 'failure',
    });

    return [];
  }

  return parsedChart.data.quotes.map(quote => ({
    currency: parsedChart.data.meta.currency,
    date: quote.date.toISOString().slice(0, DATE_SHAPE.length),
    price: quote.close,
  }));
}
