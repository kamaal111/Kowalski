import crypto from 'node:crypto';

import { describe } from 'vitest';
import { z } from 'zod';

import { integrationTest } from '@/tests/fixtures';

const StocksSearchResponseSchema = z.object({
  count: z.number(),
  quotes: z.array(
    z.object({
      symbol: z.string(),
      name: z.string(),
    }),
  ),
});

describe('Stocks Integration Tests', () => {
  integrationTest(
    'should be able to search for stocks',
    async ({ app, sessionToken, expect, getLogsForRequestId, withRequestId }) => {
      const cacheTestKey = crypto.randomUUID();
      const request = withRequestId({
        Authorization: `Bearer ${sessionToken}`,
      });
      const res = await app.request(`/app-api/stocks/search?q=AAPL&cacheTest=${cacheTestKey}`, {
        headers: request.headers,
      });

      expect(res.status).toBe(200);
      const body = StocksSearchResponseSchema.parse(await res.json());
      const logs = getLogsForRequestId(request.requestId);

      expect(body.count).toBe(1);
      expect(body.quotes).toHaveLength(1);
      expect(body.quotes[0]).toEqual(
        expect.objectContaining({
          symbol: 'AAPL',
          name: 'Apple Inc.',
        }),
      );
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'request.started',
            request_id: request.requestId,
            method: 'GET',
            path: '/app-api/stocks/search',
          }),
          expect.objectContaining({
            event: 'cache.miss',
            request_id: request.requestId,
            cache_status: 'miss',
            component: 'cache',
          }),
          expect.objectContaining({
            event: 'cache.set',
            request_id: request.requestId,
            cache_status: 'set',
            component: 'cache',
          }),
          expect.objectContaining({
            event: 'stocks.search.completed',
            request_id: request.requestId,
            result_count: 1,
            component: 'stocks',
          }),
          expect.objectContaining({
            event: 'request.completed',
            request_id: request.requestId,
            route: '/app-api/stocks/search',
            status_code: 200,
          }),
        ]),
      );
    },
  );

  integrationTest(
    'should log cache hits on repeated searches',
    async ({ app, sessionToken, expect, getLogsForRequestId, withRequestId }) => {
      const cacheTestKey = crypto.randomUUID();
      const firstRequest = withRequestId({ Authorization: `Bearer ${sessionToken}` });
      await app.request(`/app-api/stocks/search?q=AAPL&cacheTest=${cacheTestKey}`, { headers: firstRequest.headers });

      const secondRequest = withRequestId({ Authorization: `Bearer ${sessionToken}` });
      const response = await app.request(`/app-api/stocks/search?q=AAPL&cacheTest=${cacheTestKey}`, {
        headers: secondRequest.headers,
      });
      const logs = getLogsForRequestId(secondRequest.requestId);

      expect(response.status).toBe(200);
      expect(logs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: 'cache.hit',
            request_id: secondRequest.requestId,
            cache_status: 'hit',
            component: 'cache',
          }),
        ]),
      );
    },
  );

  integrationTest('should return 404 without token', async ({ app, expect }) => {
    const res = await app.request('/app-api/stocks/search?q=AAPL&cacheTest=missing-token');
    expect(res.status).toBe(404);
  });
});
