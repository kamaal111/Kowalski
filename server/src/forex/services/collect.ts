import { load as cheerioLoad } from 'cheerio';
import { desc, eq } from 'drizzle-orm';
import { parseStringPromise } from 'xml2js';

import type { Database } from '@/db';
import { exchangeRates } from '@/db/schema/forex';
import type { ServerLogger } from '@/logging';
import { logWarn } from '@/logging';
import { ExchangeRateRecord } from '../models/exchange-rate-record';
import ForexItem from '../models/forex-item';
import { ForexECPResponseSchema } from '../schemas/collect';

const BASE_FOREX_URL = new URL('https://www.ecb.europa.eu');
const HOME_URL = new URL('/home/html/rss.en.html', BASE_FOREX_URL);

export type ForexCollectionResult =
  | {
      status: 'no-data';
      latestCollectedDay: string | undefined;
      targetCollectionDay: string;
    }
  | {
      status: 'persisted';
      exchangeRate: ExchangeRateRecord;
      latestCollectedDay: string | undefined;
      storedItems: ExchangeRateRecord[];
      targetCollectionDay: string;
    }
  | {
      status: 'skipped';
      latestCollectedDay: string;
      targetCollectionDay: string;
    };

interface CollectLatestExchangeRatesOptions {
  db: Database;
  latestCollectedAt?: Date;
  logger?: ServerLogger;
  targetCollectionDay?: string;
}

export async function collectLatestExchangeRates({
  db,
  latestCollectedAt,
  logger,
  targetCollectionDay = getCurrentCollectionDay(),
}: CollectLatestExchangeRatesOptions): Promise<ForexCollectionResult> {
  const resolvedLatestCollectedAt = latestCollectedAt ?? (await getLatestCollectedAt(db));
  const latestCollectedDay =
    resolvedLatestCollectedAt == null ? undefined : getCurrentCollectionDay(resolvedLatestCollectedAt);

  if (latestCollectedDay != null && latestCollectedDay >= targetCollectionDay) {
    return {
      status: 'skipped',
      latestCollectedDay,
      targetCollectionDay,
    };
  }

  const urls = await fetchUrls();
  const fetchedExchangeRates = await fetchExchangeRates(urls, logger);
  if (fetchedExchangeRates == null || fetchedExchangeRates.ratesAreEmpty) {
    return {
      status: 'no-data',
      latestCollectedDay,
      targetCollectionDay,
    };
  }

  const storedItems = await storeExchangeRates(fetchedExchangeRates, db);
  return {
    status: 'persisted',
    exchangeRate: fetchedExchangeRates,
    latestCollectedDay,
    storedItems,
    targetCollectionDay,
  };
}

export async function getLatestCollectedAt(db: Database) {
  const latestRate = await db
    .select({ collectedAt: exchangeRates.collectedAt })
    .from(exchangeRates)
    .orderBy(desc(exchangeRates.collectedAt))
    .limit(1);

  return latestRate.at(0)?.collectedAt;
}

export function getCurrentCollectionDay(date = new Date()) {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function fetchExchangeRates(
  urls: URL[],
  logger: ServerLogger | undefined,
): Promise<ExchangeRateRecord | undefined> {
  const spreadExchangeRatesResults = await Promise.allSettled(
    urls.map(async url => {
      const response = await fetch(url);
      const content = await response.text();
      const parsedContent: unknown = await parseStringPromise(content);
      const contentObject = ForexECPResponseSchema.parse(parsedContent);
      const exchangeRatesByDate: Record<string, ExchangeRateRecord> = {};
      for (const contentItem of contentObject['rdf:RDF']?.item ?? []) {
        const item = ForexItem.fromECBResponse(contentItem);
        if (item == null) {
          continue;
        }

        const dateKey = item.date.getTime().toString();
        if (exchangeRatesByDate[dateKey] === undefined) {
          exchangeRatesByDate[dateKey] = new ExchangeRateRecord({
            date: item.date,
            base: item.rate.base,
            rates: {},
          });
        }

        exchangeRatesByDate[dateKey].addRate(item.rate.target, item.rate.value);
      }

      return exchangeRatesByDate;
    }),
  );

  let latestDate: Date | undefined;
  const combinedExchangeRates: Record<string, ExchangeRateRecord> = {};
  for (const [index, exchangeRatesResult] of spreadExchangeRatesResults.entries()) {
    if (exchangeRatesResult.status === 'rejected') {
      if (logger != null) {
        logWarn(logger, {
          event: 'forex.collect.fetch_failed',
          source_url: urls[index]?.toString(),
          error_name:
            exchangeRatesResult.reason instanceof Error
              ? exchangeRatesResult.reason.name
              : typeof exchangeRatesResult.reason,
          outcome: 'failure',
        });
      }
      continue;
    }

    const exchangeRatesByDate = exchangeRatesResult.value;
    for (const [key, exchangeRate] of Object.entries(exchangeRatesByDate)) {
      if (exchangeRate.date.getTime() > (latestDate?.getTime() ?? 0)) {
        latestDate = exchangeRate.date;
      }
      if (combinedExchangeRates[key] === undefined) {
        combinedExchangeRates[key] = exchangeRate;
      } else {
        combinedExchangeRates[key].setRates({
          ...combinedExchangeRates[key].rates,
          ...exchangeRate.rates,
        });
      }
    }
  }

  if (latestDate == null) {
    return;
  }

  return combinedExchangeRates[latestDate.getTime().toString()];
}

async function storeExchangeRates(exchangeRate: ExchangeRateRecord, db: Database) {
  const allRates = exchangeRate.calculateRates().concat([exchangeRate]);
  const ratesToCheck = allRates.filter(rate => !rate.ratesAreEmpty);
  const existingRates = await db
    .select({ base: exchangeRates.base, date: exchangeRates.date })
    .from(exchangeRates)
    .where(eq(exchangeRates.date, exchangeRate.dateString));
  const existingKeys = new Set(existingRates.map(rate => `${rate.base}-${rate.date}`));
  const itemsToStoreRecord = ratesToCheck.reduce<Record<string, ExchangeRateRecord>>((acc, calculatedRate) => {
    if (!existingKeys.has(calculatedRate.documentKey)) {
      return { ...acc, [calculatedRate.documentKey]: calculatedRate };
    }

    return acc;
  }, {});

  const itemsToStore = Object.values(itemsToStoreRecord);
  if (itemsToStore.length === 0) {
    return [];
  }

  await db.insert(exchangeRates).values(
    itemsToStore.map(item => {
      const doc = item.toDocumentObject();
      return {
        id: item.documentKey,
        date: doc.date,
        base: doc.base,
        rates: doc.rates,
      };
    }),
  );

  return itemsToStore;
}

async function fetchUrls(): Promise<URL[]> {
  const response = await fetch(HOME_URL);
  const content = await response.text();
  const urls: URL[] = [];
  const cheerioContent = cheerioLoad(content);
  const anchorTags = cheerioContent('a');

  anchorTags.each((_index, element) => {
    const link = element.attribs.href;
    if (!link || !link.includes('/rss/fxref')) {
      return;
    }

    urls.push(new URL(link, BASE_FOREX_URL));
  });

  return urls;
}
