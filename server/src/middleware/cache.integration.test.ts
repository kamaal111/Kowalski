import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { existsSync, rmSync, readdirSync } from 'fs';

import { withCache } from './cache.js';
import type { HonoContext } from '../api/contexts.js';

describe('cache middleware integration.test.ts', () => {
  beforeEach(() => {
    if (existsSync('./.test-cache')) {
      const files = readdirSync('./.test-cache');
      for (const file of files) {
        if (file.startsWith('cache-test-')) {
          rmSync(`./.test-cache/${file}`, { force: true });
        }
      }
    }
  });

  describe('basic caching', () => {
    it('should cache successful JSON responses', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve(); // Make it truly async
        callCount++;
        return c.json({ data: 'test data', timestamp: Date.now() });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-basic',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/test', cachedHandler);

      // First request - should call handler
      const response1 = await app.request('http://localhost/test');
      const data1 = (await response1.json()) as { data: string; timestamp: number };

      expect(response1.status).toBe(200);
      expect(callCount).toBe(1);

      // Second request - should use cache
      const response2 = await app.request('http://localhost/test');
      const data2 = (await response2.json()) as { data: string; timestamp: number };

      expect(response2.status).toBe(200);
      expect(callCount).toBe(1); // Handler not called again
      expect(data2).toEqual(data1); // Same data from cache
    });

    it('should differentiate between different query parameters', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        const query = c.req.query('q');
        return c.json({ query, timestamp: Date.now() });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-query',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/search', cachedHandler);

      // Request with query param 'foo'
      const response1 = await app.request('http://localhost/search?q=foo');
      const data1 = (await response1.json()) as { query: string; timestamp: number };

      // Request with query param 'bar'
      const response2 = await app.request('http://localhost/search?q=bar');
      const data2 = (await response2.json()) as { query: string; timestamp: number };

      // Request with query param 'foo' again
      const response3 = await app.request('http://localhost/search?q=foo');
      const data3 = (await response3.json()) as { query: string; timestamp: number };

      expect(callCount).toBe(2); // Only 2 unique queries
      expect(data1.query).toBe('foo');
      expect(data2.query).toBe('bar');
      expect(data3).toEqual(data1); // Third request cached
    });

    it('should sort query parameters for consistent cache keys', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ timestamp: Date.now() });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-sort',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/data', cachedHandler);

      // Request with params in different orders
      await app.request('http://localhost/data?a=1&b=2&c=3');
      await app.request('http://localhost/data?c=3&a=1&b=2');
      await app.request('http://localhost/data?b=2&c=3&a=1');

      expect(callCount).toBe(1); // All should use same cache key
    });
  });

  describe('cache skipping', () => {
    it('should not cache non-JSON responses', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.text('plain text response');
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-text',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/text', cachedHandler);

      await app.request('http://localhost/text');
      await app.request('http://localhost/text');

      expect(callCount).toBe(2); // Handler called both times
    });

    it('should not cache error responses', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ error: 'Something went wrong' }, 500);
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-error',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/error', cachedHandler);

      await app.request('http://localhost/error');
      await app.request('http://localhost/error');

      expect(callCount).toBe(2); // Handler called both times
    });

    it('should not cache 404 responses', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ error: 'Not found' }, 404);
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-404',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/notfound', cachedHandler);

      await app.request('http://localhost/notfound');
      await app.request('http://localhost/notfound');

      expect(callCount).toBe(2); // Handler called both times
    });
  });

  describe('TTL expiration', () => {
    it('should expire cache after TTL', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ data: 'test', timestamp: Date.now() });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-ttl-expire',
        maxSize: 10,
        ttl: 100, // 100ms TTL
      });

      const app = new Hono();
      app.get('/expire', cachedHandler);

      // First request
      await app.request('http://localhost/expire');
      expect(callCount).toBe(1);

      // Second request immediately - should use cache
      await app.request('http://localhost/expire');
      expect(callCount).toBe(1);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Third request - cache expired, should call handler
      await app.request('http://localhost/expire');
      expect(callCount).toBe(2);
    });

    it('should use custom TTL when provided', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ data: 'test' });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-custom-ttl',
        maxSize: 10,
        defaultTTL: 5000,
        ttl: 100, // Override with custom TTL
      });

      const app = new Hono();
      app.get('/custom', cachedHandler);

      await app.request('http://localhost/custom');
      expect(callCount).toBe(1);

      // Wait less than default TTL but more than custom TTL
      await new Promise(resolve => setTimeout(resolve, 150));

      await app.request('http://localhost/custom');
      expect(callCount).toBe(2); // Cache expired due to custom TTL
    });
  });

  describe('persistence between server restarts', () => {
    it('should persist cache across handler recreations', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        return c.json({ data: 'persistent data', timestamp: Date.now() });
      };

      // First handler instance
      const cachedHandler1 = withCache(handler, {
        keyPrefix: 'test-persist',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app1 = new Hono();
      app1.get('/persist', cachedHandler1);

      // Make first request
      const response1 = await app1.request('http://localhost/persist');
      const data1 = (await response1.json()) as { data: string; timestamp: number };
      expect(callCount).toBe(1);

      // Simulate server restart by creating new handler with same config
      const cachedHandler2 = withCache(handler, {
        keyPrefix: 'test-persist',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app2 = new Hono();
      app2.get('/persist', cachedHandler2);

      // Make second request with new handler
      const response2 = await app2.request('http://localhost/persist');
      const data2 = (await response2.json()) as { data: string; timestamp: number };

      expect(callCount).toBe(1); // Handler not called again
      expect(data2).toEqual(data1); // Same cached data
    });
  });

  describe('cache size limits', () => {
    it('should respect maxSize configuration', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        const id = c.req.query('id');
        return c.json({ id, data: `data for ${id}` });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-maxsize',
        maxSize: 3, // Only cache 3 items
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/items', cachedHandler);

      // Fill cache to max
      await app.request('http://localhost/items?id=1');
      await app.request('http://localhost/items?id=2');
      await app.request('http://localhost/items?id=3');
      expect(callCount).toBe(3);

      // Request cached items
      await app.request('http://localhost/items?id=1');
      await app.request('http://localhost/items?id=2');
      await app.request('http://localhost/items?id=3');
      expect(callCount).toBe(3); // No new calls

      // Add new item, should evict oldest
      await app.request('http://localhost/items?id=4');
      expect(callCount).toBe(4);

      // Request oldest item again, should be evicted
      await app.request('http://localhost/items?id=1');
      expect(callCount).toBe(5); // Cache miss, handler called
    });
  });

  describe('unique database per prefix', () => {
    it('should use separate databases for different cache prefixes', async () => {
      let callCount1 = 0;
      let callCount2 = 0;

      const handler1 = async (c: HonoContext) => {
        await Promise.resolve();
        callCount1++;
        return c.json({ cache: 'cache1', data: 'data1' });
      };

      const handler2 = async (c: HonoContext) => {
        await Promise.resolve();
        callCount2++;
        return c.json({ cache: 'cache2', data: 'data2' });
      };

      const cachedHandler1 = withCache(handler1, {
        keyPrefix: 'test-cache1',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const cachedHandler2 = withCache(handler2, {
        keyPrefix: 'test-cache2',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/cache1', cachedHandler1);
      app.get('/cache2', cachedHandler2);

      // Request both caches
      const response1a = await app.request('http://localhost/cache1');
      const response2a = await app.request('http://localhost/cache2');

      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      // Request again
      const response1b = await app.request('http://localhost/cache1');
      const response2b = await app.request('http://localhost/cache2');

      // Both should be cached independently
      expect(callCount1).toBe(1);
      expect(callCount2).toBe(1);

      const data1a = (await response1a.json()) as { cache: string; data: string };
      const data1b = (await response1b.json()) as { cache: string; data: string };
      expect(data1b).toEqual(data1a);

      const data2a = (await response2a.json()) as { cache: string; data: string };
      const data2b = (await response2b.json()) as { cache: string; data: string };
      expect(data2b).toEqual(data2a);

      // Verify they have different data
      expect(data1a).not.toEqual(data2a);
    });
  });

  describe('real-world scenarios', () => {
    it('should handle rapid concurrent requests', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        callCount++;
        // Simulate slow API
        await new Promise(resolve => setTimeout(resolve, 50));
        return c.json({ data: 'slow data', timestamp: Date.now() });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-concurrent',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/slow', cachedHandler);

      // First request
      await app.request('http://localhost/slow');
      expect(callCount).toBe(1);

      // Make 10 rapid requests
      const promises = Array.from({ length: 10 }, async () => await app.request('http://localhost/slow'));
      await Promise.all(promises);

      // Handler should only be called once (first request)
      expect(callCount).toBe(1);
    });

    it('should handle large response payloads', async () => {
      let callCount = 0;

      const handler = async (c: HonoContext) => {
        await Promise.resolve();
        callCount++;
        // Generate large array of data
        const largeArray = Array.from({ length: 1000 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          description: `This is a description for item ${i}`.repeat(10),
        }));
        return c.json({ items: largeArray });
      };

      const cachedHandler = withCache(handler, {
        keyPrefix: 'test-large',
        maxSize: 10,
        defaultTTL: 60000,
      });

      const app = new Hono();
      app.get('/large', cachedHandler);

      const response1 = await app.request('http://localhost/large');
      const data1 = (await response1.json()) as { items: { id: number; name: string; description: string }[] };

      const response2 = await app.request('http://localhost/large');
      const data2 = (await response2.json()) as { items: { id: number; name: string; description: string }[] };

      expect(callCount).toBe(1);
      expect(data2).toEqual(data1);
      expect(data2.items.length).toBe(1000);
    });
  });
});
