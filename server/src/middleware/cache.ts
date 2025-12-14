import type { Context } from 'hono';

import { LRUCache } from '../utils/cache.js';
import { ONE_MINUTE_IN_MILLISECONDS } from '../constants/common.js';
import type { HonoContext } from '../api/contexts.js';
import { logger } from './logging.js';

const DEFAULT_TTL = 5 * ONE_MINUTE_IN_MILLISECONDS;
const DEFAULT_MAX_SIZE = 1000;

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
  const cache = new LRUCache<string, unknown>(config.maxSize ?? DEFAULT_MAX_SIZE, config.defaultTTL ?? DEFAULT_TTL);

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
