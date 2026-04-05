import { afterEach, describe, expect, vi } from 'vitest';
import { z } from 'zod';

import { integrationTest } from '@/tests/fixtures';
import { exchangeRates } from '@/db/schema/forex';
import { FOREX_COLLECT_ROUTE_PATH } from '../handlers/collect';
import { BASE_CURRENCY } from '../constants';
import { getCurrentCollectionDay } from '../services/collect';

const HOME_URL = 'https://www.ecb.europa.eu/home/html/rss.en.html';
const SUCCESS_URL = 'https://www.ecb.europa.eu/stats/rss/fxref/eurofxref-usd.xml';
const FAILURE_URL = 'https://www.ecb.europa.eu/stats/rss/fxref/eurofxref-fail.xml';
const SUCCESS_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cb="http://www.cbwiki.net/wiki/index.php/Specification_1.2/">',
  '  <item>',
  '    <dc:date>2026-03-28T00:00:00.000Z</dc:date>',
  '    <cb:statistics>',
  '      <cb:exchangeRate>',
  '        <cb:value>1.08</cb:value>',
  '        <cb:baseCurrency>EUR</cb:baseCurrency>',
  '        <cb:targetCurrency>USD</cb:targetCurrency>',
  '      </cb:exchangeRate>',
  '    </cb:statistics>',
  '  </item>',
  '</rdf:RDF>',
].join('\n');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Forex collect logging', () => {
  integrationTest(
    'logs fetch failures and persisted rows during collection',
    async ({ app, getLogsForRequestId, withRequestId }) => {
      const fetchMock = vi.fn((input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === HOME_URL) {
          return new Response(
            [
              '<html><body>',
              `<a href="${new URL(SUCCESS_URL).pathname}">USD</a>`,
              `<a href="${new URL(FAILURE_URL).pathname}">FAIL</a>`,
              '</body></html>',
            ].join(''),
            { status: 200, headers: { 'content-type': 'text/html' } },
          );
        }

        if (url === SUCCESS_URL) {
          return new Response(SUCCESS_XML, { status: 200, headers: { 'content-type': 'application/xml' } });
        }

        if (url === FAILURE_URL) {
          throw new Error('Simulated upstream failure');
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      });

      vi.stubGlobal('fetch', fetchMock);

      const request = withRequestId();
      const response = await app.request(FOREX_COLLECT_ROUTE_PATH, {
        method: 'POST',
        headers: request.headers,
      });
      const body = z
        .object({
          data: z.object({ stored: z.number() }),
          skipped: z.literal(false),
        })
        .parse(await response.json());
      const logs = getLogsForRequestId(request.requestId);
      const fetchFailedLog = logs.find(log => log.event === 'forex.collect.fetch_failed');
      const persistedLog = logs.find(log => log.event === 'forex.collect.persisted');

      expect(response.status).toBe(200);
      expect(body.data.stored).toBeGreaterThan(0);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'forex.collect.started',
            request_id: request.requestId,
            component: 'forex',
          }),
          expect.objectContaining({
            event: 'forex.collect.fetch_failed',
            request_id: request.requestId,
            component: 'forex',
            source_url: FAILURE_URL,
          }),
          expect.objectContaining({
            event: 'forex.collect.persisted',
            request_id: request.requestId,
            component: 'forex',
          }),
        ]),
      );
      expect(fetchFailedLog?.source_url).toBe(FAILURE_URL);
      expect(typeof persistedLog?.stored_count).toBe('number');
      expect(getStoredCount(persistedLog)).toBeGreaterThan(0);
    },
  );

  integrationTest(
    'skips fetching when today has already been collected',
    async ({ app, db, getLogsForRequestId, withRequestId }) => {
      const currentCollectionDay = getCurrentCollectionDay();
      await db.insert(exchangeRates).values({
        id: `${BASE_CURRENCY}-2026-04-03`,
        base: BASE_CURRENCY,
        date: '2026-04-03',
        collectedAt: new Date(),
        rates: { USD: 1.08, GBP: 0.84 },
      });

      const fetchMock = vi.fn(() => {
        throw new Error('Fetch should not run when the latest collected date is already today');
      });

      vi.stubGlobal('fetch', fetchMock);

      const request = withRequestId();
      const response = await app.request(FOREX_COLLECT_ROUTE_PATH, {
        method: 'POST',
        headers: request.headers,
      });
      const body = z
        .object({
          data: z.object({
            date: z.string(),
            stored: z.literal(0),
          }),
          skipped: z.literal(true),
        })
        .parse(await response.json());
      const logs = getLogsForRequestId(request.requestId);

      expect(response.status).toBe(200);
      expect(body.data.date).toBe(currentCollectionDay);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'forex.collect.started',
            request_id: request.requestId,
            component: 'forex',
          }),
          expect.objectContaining({
            event: 'forex.collect.skipped',
            request_id: request.requestId,
            component: 'forex',
            latest_collected_date: currentCollectionDay,
            target_date: currentCollectionDay,
            outcome: 'success',
          }),
        ]),
      );
    },
  );
});

function getStoredCount(log: { stored_count?: unknown } | undefined) {
  return typeof log?.stored_count === 'number' ? log.stored_count : 0;
}
