import { describe, expect, it } from 'vitest';

import { SERVER_MODES } from '../api/env';
import { createCacheDbPath } from './cache';

describe('createCacheDbPath', () => {
  it('uses the configured cache directory outside test mode', () => {
    expect(createCacheDbPath('stocks:search', SERVER_MODES.SERVER, '/tmp/cache')).toBe(
      '/tmp/cache/cache-stocks-search.db',
    );
  });

  it('keeps using the test cache directory in test mode', () => {
    expect(createCacheDbPath('stocks:search', SERVER_MODES.TEST, '/tmp/cache')).toBe(
      './.test-cache/cache-stocks-search.db',
    );
  });
});
