import YahooFinance from 'yahoo-finance2';
import type { ChartOptionsWithReturnArray, ChartResultArray } from 'yahoo-finance2/modules/chart';
import type { QuoteOptionsWithReturnArray, QuoteResponseArray } from 'yahoo-finance2/modules/quote';
import type { SearchOptions, SearchResult } from 'yahoo-finance2/modules/search';

export interface YahooFinanceClient {
  search(query: string, queryOptionsOverrides?: SearchOptions): Promise<SearchResult>;
  quote(query: string[], queryOptionsOverrides?: QuoteOptionsWithReturnArray): Promise<QuoteResponseArray>;
  chart(symbol: string, queryOptionsOverrides: ChartOptionsWithReturnArray): Promise<ChartResultArray>;
}

export let yahooFinanceClient: YahooFinanceClient = new YahooFinance();

export function setYahooFinanceClientForTests(client: YahooFinanceClient) {
  yahooFinanceClient = client;
}
