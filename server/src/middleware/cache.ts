import { asserts } from '@kamaalio/kamaal';
import type { Context } from 'hono';

import type { HonoContext } from '../api/contexts.ts';
import env, { SERVER_MODES, type ServerMode } from '../api/env.ts';
import { ONE_MINUTE_IN_MILLISECONDS } from '../constants/common.ts';
import { withRequestLogger } from '../logging/http.ts';
import { logInfo } from '../logging/index.ts';
import { LRUCache } from '../utils/cache.ts';

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

export function withCache<ContextType extends HonoContext, ResponseType extends Response, CachedType>(
  handler: (c: ContextType) => Promise<ResponseType>,
  config: CacheConfig,
  cacheResponse: (response: Response) => Promise<CachedType>,
  cachedResponse: (c: ContextType, cached: CachedType) => ResponseType,
): (c: ContextType) => Promise<ResponseType> {
  const dbPath = createCacheDbPath(config.keyPrefix, env.MODE, env.CACHE_DIR);

  const cache = new LRUCache<string, CachedType>(
    config.maxSize ?? DEFAULT_MAX_SIZE,
    config.defaultTTL ?? DEFAULT_TTL,
    dbPath,
  );

  cacheInstances.push(cache);

  return async c => {
    const cacheKey = createCacheKey(c, config.keyPrefix);
    const logger = withRequestLogger(c, { component: 'cache' });
    const cached = cache.get(cacheKey);

    if (cached != null) {
      logInfo(logger, { event: 'cache.hit', cache_status: 'hit', cache_key: cacheKey, outcome: 'success' });

      return cachedResponse(c, cached);
    }

    logInfo(logger, { event: 'cache.miss', cache_status: 'miss', cache_key: cacheKey, outcome: 'success' });
    const response = await handler(c);
    const isJson = isJsonResponse(response);

    if (!response.ok || !isJson) {
      logInfo(logger, {
        event: 'cache.skip',
        cache_status: 'skip',
        cache_key: cacheKey,
        status_code: response.status,
        is_json: isJson,
        outcome: 'failure',
      });

      return response;
    }

    const data = await cacheResponse(response);
    cache.set(cacheKey, data, config.ttl);
    const ttl = config.ttl ?? config.defaultTTL ?? DEFAULT_TTL;
    logInfo(logger, { event: 'cache.set', cache_status: 'set', cache_key: cacheKey, ttl_ms: ttl, outcome: 'success' });

    return response;
  };
}

export function createCacheDbPath(keyPrefix: string, mode: ServerMode, cacheDir: string): string {
  const effectiveCacheDir = mode === SERVER_MODES.TEST ? './.test-cache' : cacheDir;

  return `${effectiveCacheDir}/cache-${keyPrefix.replace(/[/:]/g, '-')}.db`;
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

  if (!queryString) {
    return prefix;
  }

  return `${prefix}:${queryString}`;
}
