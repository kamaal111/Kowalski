import { load as cheerioLoad } from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { eq } from 'drizzle-orm';

import type { HonoContext } from '../../api/contexts.js';
import type { Database } from '../../db/index.js';
import { ExchangeRateRecord } from '../models/exchange-rate-record.js';
import { ForexECPResponseSchema } from '../schemas/collect.js';
import ForexItem from '../models/forex-item.js';
import { exchangeRates } from '../../db/schema/forex.js';

const BASE_FOREX_URL = new URL('https://www.ecb.europa.eu');
const HOME_URL = new URL('/home/html/rss.en.html', BASE_FOREX_URL);

async function collect(c: HonoContext) {
  const urls = await fetchUrls();
  const fetchedExchangeRates = await fetExchangeRates(urls);
  if (!fetchedExchangeRates || fetchedExchangeRates.ratesAreEmpty) {
    return c.json({ message: 'No exchange rates found' }, 404);
  }

  const db = c.get('db');
  const storedItems = await storeExchangeRates(fetchedExchangeRates, db);

  return c.json({ stored: storedItems.length, exchangeRate: fetchedExchangeRates }, 200);
}

async function fetExchangeRates(urls: URL[]): Promise<ExchangeRateRecord | undefined> {
  const spreadExchangeRatesResults = await Promise.allSettled(
    urls.map(async url => {
      const urlPart = url.toString().split('/').at(-1);
      if (!urlPart) {
        throw new Error('Invalid URL format');
      }

      const response = await fetch(url);
      const content = await response.text();
      const parsedContent: unknown = await parseStringPromise(content);
      const contentObject = ForexECPResponseSchema.parse(parsedContent);
      const exchangeRates: Record<string, ExchangeRateRecord> = {};
      for (const contentItem of contentObject['rdf:RDF']?.item ?? []) {
        const item = ForexItem.fromECBResponse(contentItem);
        if (!item) {
          continue;
        }

        const dateKey = item.date.getTime().toString();
        if (exchangeRates[dateKey] === undefined) {
          exchangeRates[dateKey] = new ExchangeRateRecord({
            date: item.date,
            base: item.rate.base,
            rates: {},
          });
        }

        exchangeRates[dateKey].addRate(item.rate.target, item.rate.value);
      }

      return exchangeRates;
    }),
  );

  let latestDate: Date | undefined;
  const combinedExchangeRates: Record<string, ExchangeRateRecord> = {};
  for (const exchangeRatesResult of spreadExchangeRatesResults) {
    if (exchangeRatesResult.status === 'rejected') {
      console.warn(`Failed to get exchange rates;`, exchangeRatesResult.reason);
      continue;
    }

    const exchangeRates = exchangeRatesResult.value;
    for (const [key, exchangeRate] of Object.entries(exchangeRates)) {
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

  if (!latestDate) {
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
  const existingKeys = new Set(existingRates.map(r => `${r.base}-${r.date}`));
  const itemsToStoreRecord = ratesToCheck.reduce<Record<string, ExchangeRateRecord>>((acc, calculatedRate) => {
    if (!existingKeys.has(calculatedRate.documentKey)) {
      return { ...acc, [calculatedRate.documentKey]: calculatedRate };
    }
    return acc;
  }, {});

  const itemsToStore = Object.values(itemsToStoreRecord);
  if (itemsToStore.length === 0) {
    console.log('no new data found to save');
    return [];
  }

  console.log(`saving ${itemsToStore.length} items to database`);
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

export default collect;
