import { ONE_MINUTE_IN_MILLISECONDS } from '../constants/common.js';

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL = 5 * ONE_MINUTE_IN_MILLISECONDS;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<K, V> {
  private cache: Map<K, CacheEntry<V>>;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(maxSize = DEFAULT_MAX_SIZE, defaultTTL = DEFAULT_TTL) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    const effectiveTTL = ttl ?? this.defaultTTL;
    const expiresAt = Date.now() + effectiveTTL;
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, { value, expiresAt });
  }
}
