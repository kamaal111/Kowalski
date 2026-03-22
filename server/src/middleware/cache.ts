import type { Context } from 'hono';
import { asserts } from '@kamaalio/kamaal';

import { LRUCache } from '../utils/cache';
import { ONE_MINUTE_IN_MILLISECONDS } from '../constants/common';
import type { HonoContext } from '../api/contexts';
import { logger } from './logging';
import env, { SERVER_MODES } from '../api/env';

const DEFAULT_TTL = 5 * ONE_MINUTE_IN_MILLISECONDS;
const DEFAULT_MAX_SIZE = 1000;

const cacheInstances: LRUCache[] = [];

export function closeAllCaches(): void {
  let cache = cacheInstances.pop();
  while (cache != null) {
    cache.close();
    cache = cacheInstances.pop();
  }

  asserts.invariant(cache == null, 'Cache should be nullish');
  asserts.invariant(cacheInstances.length === 0, 'Cache instances should be empty');
}

interface CacheConfig {
  keyPrefix: string;
  maxSize?: number;
  defaultTTL?: number;
  ttl?: number;
}

export function withCache<THandler extends (c: HonoContext) => Promise<Response>>(
  handler: THandler,
  config: CacheConfig,
): THandler {
  const cacheDir = env.MODE === SERVER_MODES.TEST ? './.test-cache' : '.';
  const dbPath = `${cacheDir}/cache-${config.keyPrefix.replace(/[/:]/g, '-')}.db`;
  const cache = new LRUCache<string, unknown>(
    config.maxSize ?? DEFAULT_MAX_SIZE,
    config.defaultTTL ?? DEFAULT_TTL,
    dbPath,
  );

  cacheInstances.push(cache);

  return (async c => {
    const cacheKey = createCacheKey(c, config.keyPrefix);
    const cached = cache.get(cacheKey);
    if (cached != null) {
      logger(c, '[Cache] HIT:', cacheKey);
      return c.json(cached);
    }

    logger(c, '[Cache] MISS:', cacheKey);
    const response = await handler(c);
    const isJson = isJsonResponse(response);
    if (!response.ok || !isJson) {
      logger(c, `[Cache] SKIP: ${cacheKey} (status: ${response.status}, json: ${isJson})`);
      return response;
    }

    const clonedResponse = response.clone();
    const data: unknown = await clonedResponse.json();
    cache.set(cacheKey, data, config.ttl);
    const ttl = config.ttl ?? config.defaultTTL ?? DEFAULT_TTL;
    logger(c, `[Cache] SET: ${cacheKey} (TTL: ${ttl}ms)`);

    return response;
  }) as THandler;
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('application/json') === true;
}

function createCacheKey(c: Context, prefix: string): string {
  const url = new URL(c.req.url);
  const queryString = Array.from(url.searchParams.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('&');
  if (!queryString) return prefix;

  return `${prefix}:${queryString}`;
}
