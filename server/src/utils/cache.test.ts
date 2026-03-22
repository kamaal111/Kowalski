import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync } from 'fs';
import { LRUCache } from './cache';

describe('LRUCache', () => {
  const testDbPath = './test-cache.db';

  const cleanupDatabase = () => {
    if (existsSync(testDbPath)) {
      rmSync(testDbPath);
    }
    // Clean up WAL and SHM files
    if (existsSync(`${testDbPath}-wal`)) {
      rmSync(`${testDbPath}-wal`);
    }
    if (existsSync(`${testDbPath}-shm`)) {
      rmSync(`${testDbPath}-shm`);
    }
  };

  beforeEach(() => {
    cleanupDatabase();
  });

  afterEach(() => {
    cleanupDatabase();
  });

  describe('basic operations', () => {
    it('should store and retrieve a value', () => {
      const cache = new LRUCache<string, string>(10, 60000, testDbPath);
      cache.set('key1', 'value1');
      const result = cache.get('key1');
      cache.close();

      expect(result).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      const cache = new LRUCache<string, string>(10, 60000, testDbPath);
      const result = cache.get('nonexistent');
      cache.close();

      expect(result).toBeNull();
    });

    it('should handle complex key types', () => {
      const cache = new LRUCache<{ id: number; type: string }, string>(10, 60000, testDbPath);
      const key = { id: 1, type: 'user' };
      cache.set(key, 'user-data');
      const result = cache.get(key);
      cache.close();

      expect(result).toBe('user-data');
    });

    it('should handle complex value types', () => {
      const cache = new LRUCache<string, { name: string; age: number }>(10, 60000, testDbPath);
      const value = { name: 'John', age: 30 };
      cache.set('user', value);
      const result = cache.get('user');
      cache.close();

      expect(result).toEqual(value);
    });

    it('should update existing keys', () => {
      const cache = new LRUCache<string, string>(10, 60000, testDbPath);
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      const result = cache.get('key1');
      cache.close();

      expect(result).toBe('value2');
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const cache = new LRUCache<string, string>(10, 100, testDbPath); // 100ms TTL
      cache.set('key1', 'value1');

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = cache.get('key1');
      cache.close();

      expect(result).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      const cache = new LRUCache<string, string>(10, 1000, testDbPath); // 1000ms default TTL
      cache.set('key1', 'value1', 100); // 100ms custom TTL

      // Wait for custom TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = cache.get('key1');
      cache.close();

      expect(result).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      const cache = new LRUCache<string, string>(10, 1000, testDbPath); // 1000ms TTL
      cache.set('key1', 'value1');

      // Wait less than TTL
      await new Promise(resolve => setTimeout(resolve, 100));

      const result = cache.get('key1');
      cache.close();

      expect(result).toBe('value1');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used item when cache is full', () => {
      const cache = new LRUCache<string, string>(3, 60000, testDbPath);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Cache is now full, adding a new item should evict key1
      cache.set('key4', 'value4');

      const result1 = cache.get('key1');
      const result2 = cache.get('key2');
      const result3 = cache.get('key3');
      const result4 = cache.get('key4');
      cache.close();

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
      expect(result3).toBe('value3');
      expect(result4).toBe('value4');
    });

    it('should update access time on get', async () => {
      const cache = new LRUCache<string, string>(3, 60000, testDbPath);

      cache.set('key1', 'value1');
      await new Promise(resolve => setTimeout(resolve, 2));
      cache.set('key2', 'value2');
      await new Promise(resolve => setTimeout(resolve, 2));
      cache.set('key3', 'value3');
      await new Promise(resolve => setTimeout(resolve, 2));

      // Access key1 to make it recently used
      cache.get('key1');
      await new Promise(resolve => setTimeout(resolve, 2));

      // Add a new item, should evict key2 (least recently used)
      cache.set('key4', 'value4');

      const result1 = cache.get('key1');
      const result2 = cache.get('key2');
      const result4 = cache.get('key4');
      cache.close();

      expect(result1).toBe('value1');
      expect(result2).toBeNull();
      expect(result4).toBe('value4');
    });

    it('should not evict when updating existing key', () => {
      const cache = new LRUCache<string, string>(3, 60000, testDbPath);

      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Update existing key, should not evict anything
      cache.set('key2', 'value2-updated');

      const result1 = cache.get('key1');
      const result2 = cache.get('key2');
      const result3 = cache.get('key3');
      cache.close();

      expect(result1).toBe('value1');
      expect(result2).toBe('value2-updated');
      expect(result3).toBe('value3');
    });
  });

  describe('persistence', () => {
    it('should persist data between instantiations', () => {
      // Create cache and add data
      const cache1 = new LRUCache<string, string>(10, 60000, testDbPath);
      cache1.set('key1', 'value1');
      cache1.set('key2', 'value2');
      cache1.close();

      // Create new cache instance with same database
      const cache2 = new LRUCache<string, string>(10, 60000, testDbPath);
      const result1 = cache2.get('key1');
      const result2 = cache2.get('key2');
      cache2.close();

      expect(result1).toBe('value1');
      expect(result2).toBe('value2');
    });

    it('should clean up expired entries on initialization', async () => {
      // Create cache with short TTL and add data
      const cache1 = new LRUCache<string, string>(10, 100, testDbPath);
      cache1.set('key1', 'value1');
      cache1.set('key2', 'value2', 5000); // Long TTL
      cache1.close();

      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Create new cache instance
      const cache2 = new LRUCache<string, string>(10, 60000, testDbPath);
      const result1 = cache2.get('key1');
      const result2 = cache2.get('key2');
      cache2.close();

      expect(result1).toBeNull();
      expect(result2).toBe('value2');
    });

    it('should persist complex data structures', () => {
      interface TestData {
        id: number;
        name: string;
        tags: string[];
        metadata: { created: string; updated: string };
      }

      const cache1 = new LRUCache<string, TestData>(10, 60000, testDbPath);
      const testData: TestData = {
        id: 1,
        name: 'Test',
        tags: ['tag1', 'tag2'],
        metadata: {
          created: '2025-01-01',
          updated: '2025-01-02',
        },
      };

      cache1.set('complex', testData);
      cache1.close();

      const cache2 = new LRUCache<string, TestData>(10, 60000, testDbPath);
      const result = cache2.get('complex');
      cache2.close();

      expect(result).toEqual(testData);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings as keys and values', () => {
      const cache = new LRUCache<string, string>(10, 60000, testDbPath);
      cache.set('', '');
      const result = cache.get('');
      cache.close();

      expect(result).toBe('');
    });

    it('should handle null values', () => {
      const cache = new LRUCache<string, string | null>(10, 60000, testDbPath);
      cache.set('key1', null);
      const result = cache.get('key1');
      cache.close();

      expect(result).toBeNull();
    });

    it('should handle zero as a value', () => {
      const cache = new LRUCache<string, number>(10, 60000, testDbPath);
      cache.set('key1', 0);
      const result = cache.get('key1');
      cache.close();

      expect(result).toBe(0);
    });

    it('should handle false as a value', () => {
      const cache = new LRUCache<string, boolean>(10, 60000, testDbPath);
      cache.set('key1', false);
      const result = cache.get('key1');
      cache.close();

      expect(result).toBe(false);
    });

    it('should handle arrays as values', () => {
      const cache = new LRUCache<string, number[]>(10, 60000, testDbPath);
      const array = [1, 2, 3, 4, 5];
      cache.set('key1', array);
      const result = cache.get('key1');
      cache.close();

      expect(result).toEqual(array);
    });

    it('should handle large objects', () => {
      const cache = new LRUCache<string, { data: string }>(10, 60000, testDbPath);
      const largeData = { data: 'x'.repeat(10000) };
      cache.set('key1', largeData);
      const result = cache.get('key1');
      cache.close();

      expect(result).toEqual(largeData);
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple sets and gets', () => {
      const cache = new LRUCache<string, number>(100, 60000, testDbPath);

      // Set multiple values
      for (let i = 0; i < 50; i++) {
        cache.set(`key${i}`, i);
      }

      // Get and verify all values
      for (let i = 0; i < 50; i++) {
        expect(cache.get(`key${i}`)).toBe(i);
      }

      cache.close();
    });

    it('should maintain data integrity with rapid updates', () => {
      const cache = new LRUCache<string, number>(10, 60000, testDbPath);

      // Rapidly update the same key
      for (let i = 0; i < 100; i++) {
        cache.set('counter', i);
      }

      const result = cache.get('counter');
      cache.close();

      expect(result).toBe(99);
    });
  });
});
