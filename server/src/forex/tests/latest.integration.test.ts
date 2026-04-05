import { describe, expect } from 'vitest';

import { FOREX_ROUTE_NAME } from '..';
import type { Database } from '@/db';
import { exchangeRates } from '@/db/schema/forex';
import { STATUS_CODES } from '@/constants/http';
import { APP_API_BASE_PATH } from '@/constants/common';
import { ErrorResponseSchema } from '@/schemas/errors';
import { integrationTest } from '@/tests/fixtures';
import { BASE_CURRENCY } from '../constants';
import { ForexLatestResponseSchema } from '../schemas/latest';

const LATEST_FOREX_PATH = `${APP_API_BASE_PATH}${FOREX_ROUTE_NAME}/latest`;

describe('Forex latest route', () => {
  integrationTest(
    'returns the latest rates for the default base currency when the query is absent',
    async ({ app, db, getLogsForRequestId, withRequestId }) => {
      await seedExchangeRate(db, {
        base: BASE_CURRENCY,
        date: '2026-03-28',
        rates: { USD: 1.08, GBP: 0.84 },
      });
      await seedExchangeRate(db, {
        base: BASE_CURRENCY,
        date: '2026-03-29',
        rates: { USD: 1.09, GBP: 0.85 },
      });

      const request = withRequestId();
      const response = await app.request(LATEST_FOREX_PATH, {
        method: 'GET',
        headers: request.headers,
      });
      const body = await expectSuccessfulLatestResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        base: BASE_CURRENCY,
        date: '2026-03-29',
        rates: { USD: 1.09, GBP: 0.85 },
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'forex.latest.started',
            component: 'forex',
            request_id: request.requestId,
            route: LATEST_FOREX_PATH,
            requested_base: BASE_CURRENCY,
            resolved_base: BASE_CURRENCY,
          }),
          expect.objectContaining({
            event: 'forex.latest.completed',
            component: 'forex',
            request_id: request.requestId,
            route: LATEST_FOREX_PATH,
            base: BASE_CURRENCY,
            result_count: 2,
            outcome: 'success',
          }),
        ]),
      );
    },
  );

  integrationTest('returns rates for an explicit base query', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: 'USD',
      date: '2026-03-29',
      rates: { EUR: 0.92, GBP: 0.78 },
    });

    const response = await app.request(`${LATEST_FOREX_PATH}?base=usd`, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(body).toEqual({
      base: 'USD',
      date: '2026-03-29',
      rates: { EUR: 0.92, GBP: 0.78 },
    });
  });

  integrationTest('filters rates by requested symbols', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09, GBP: 0.85, CHF: 0.96 },
    });

    const response = await app.request(`${LATEST_FOREX_PATH}?symbols=usd, chf , eur, invalid`, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(body).toEqual({
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09, CHF: 0.96 },
    });
  });

  integrationTest('returns all rates when symbols is absent', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09, GBP: 0.85, CHF: 0.96 },
    });

    const response = await app.request(LATEST_FOREX_PATH, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(body.rates).toEqual({ USD: 1.09, GBP: 0.85, CHF: 0.96 });
  });

  integrationTest('returns all rates when symbols is an asterisk', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09, GBP: 0.85, CHF: 0.96 },
    });

    const response = await app.request(`${LATEST_FOREX_PATH}?symbols=*`, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(body.rates).toEqual({ USD: 1.09, GBP: 0.85, CHF: 0.96 });
  });

  integrationTest(
    'returns 404 when no data exists for the requested base',
    async ({ app, db, getLogsForRequestId, withRequestId }) => {
      await seedExchangeRate(db, {
        base: BASE_CURRENCY,
        date: '2026-03-29',
        rates: { USD: 1.09, GBP: 0.85 },
      });

      const request = withRequestId();
      const response = await app.request(`${LATEST_FOREX_PATH}?base=GBP`, {
        method: 'GET',
        headers: request.headers,
      });
      const body = await expectNotFoundResponse(response);
      const logs = getLogsForRequestId(request.requestId);

      expect(body).toEqual({
        message: 'No exchange rates found',
        code: 'NOT_FOUND',
      });
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'forex.latest.not_found',
            component: 'forex',
            request_id: request.requestId,
            route: LATEST_FOREX_PATH,
            base: 'GBP',
            outcome: 'failure',
          }),
        ]),
      );
    },
  );

  integrationTest('falls back to EUR when the base query is invalid', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09, GBP: 0.85 },
    });

    const response = await app.request(`${LATEST_FOREX_PATH}?base=invalid`, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(body.base).toBe(BASE_CURRENCY);
    expect(body.date).toBe('2026-03-29');
    expect(body.rates).toEqual({ USD: 1.09, GBP: 0.85 });
  });

  integrationTest('returns the exact ForexKit contract shape', async ({ app, db }) => {
    await seedExchangeRate(db, {
      base: BASE_CURRENCY,
      date: '2026-03-29',
      rates: { USD: 1.09 },
    });

    const response = await app.request(LATEST_FOREX_PATH, { method: 'GET' });
    const body = await expectSuccessfulLatestResponse(response);

    expect(Object.keys(body)).toEqual(['base', 'date', 'rates']);
    expect(Object.keys(body.rates)).toEqual(['USD']);
  });
});

async function seedExchangeRate(db: Database, item: { base: string; date: string; rates: Record<string, number> }) {
  await db.insert(exchangeRates).values({
    id: `${item.base}-${item.date}`,
    base: item.base,
    date: item.date,
    rates: item.rates,
  });
}

async function expectSuccessfulLatestResponse(response: Response) {
  expect(response.status).toBe(STATUS_CODES.OK);

  return ForexLatestResponseSchema.parse(await response.json());
}

async function expectNotFoundResponse(response: Response) {
  expect(response.status).toBe(STATUS_CODES.NOT_FOUND);

  return ErrorResponseSchema.parse(await response.json());
}
