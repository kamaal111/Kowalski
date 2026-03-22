import { describe } from 'vitest';

import type { StocksSearchResponse } from '../schemas/search.js';
import { integrationTest } from '@/tests/fixtures.js';

describe('Stocks Integration Tests', () => {
  integrationTest('should be able to search for stocks', async ({ app, sessionToken, expect }) => {
    const res = await app.request('/app-api/stocks/search?q=AAPL', {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as StocksSearchResponse;
    expect(body.count).toBe(1);
    expect(body.quotes).toHaveLength(1);
    expect(body.quotes[0]).toEqual(
      expect.objectContaining({
        symbol: 'AAPL',
        name: 'Apple Inc.',
      }),
    );
  });

  integrationTest('should return 404 without token', async ({ app, expect }) => {
    const res = await app.request('/app-api/stocks/search?q=AAPL');
    expect(res.status).toBe(404);
  });
});
