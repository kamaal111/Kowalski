import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { z } from 'zod';

import { ONE_MINUTE_IN_MILLISECONDS } from '../constants/common';

const DEFAULT_MAX_SIZE = 1000;
const DEFAULT_TTL = 5 * ONE_MINUTE_IN_MILLISECONDS;

const CacheRowSchema = z.object({
  value: z.string(),
  expiresAt: z.number(),
});

const CacheCountSchema = z.object({
  count: z.number(),
});

export class LRUCache<K = unknown, V = unknown> {
  private db: Database.Database;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(maxSize = DEFAULT_MAX_SIZE, defaultTTL = DEFAULT_TTL, dbPath = './cache.db') {
    const dir = path.dirname(dbPath);
    if (dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expiresAt INTEGER NOT NULL,
        lastAccessed INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_last_accessed ON cache(lastAccessed);
      CREATE INDEX IF NOT EXISTS idx_expires_at ON cache(expiresAt);
    `);

    this.cleanupExpired();
  }

  get(key: K): V | null {
    const keyStr = JSON.stringify(key);
    const now = Date.now();

    const rawRow = this.db.prepare('SELECT value, expiresAt FROM cache WHERE key = ?').get(keyStr);
    if (!rawRow) return null;

    const row = CacheRowSchema.parse(rawRow);
    if (now > row.expiresAt) {
      this.db.prepare('DELETE FROM cache WHERE key = ?').run(keyStr);
      return null;
    }

    this.db.prepare('UPDATE cache SET lastAccessed = ? WHERE key = ?').run(now, keyStr);

    return JSON.parse(row.value) as V;
  }

  set(key: K, value: V, ttl?: number): void {
    const keyStr = JSON.stringify(key);
    const valueStr = JSON.stringify(value);
    const effectiveTTL = ttl ?? this.defaultTTL;
    const expiresAt = Date.now() + effectiveTTL;
    const now = Date.now();

    const existing = this.db.prepare('SELECT 1 FROM cache WHERE key = ?').get(keyStr);

    if (!existing) {
      const rawCount = this.db.prepare('SELECT COUNT(*) as count FROM cache').get();
      const count = CacheCountSchema.parse(rawCount);
      if (count.count >= this.maxSize) {
        this.db
          .prepare('DELETE FROM cache WHERE key = (SELECT key FROM cache ORDER BY lastAccessed ASC LIMIT 1)')
          .run();
      }
    }

    this.db
      .prepare(
        `
      INSERT INTO cache (key, value, expiresAt, lastAccessed)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        expiresAt = excluded.expiresAt,
        lastAccessed = excluded.lastAccessed
    `,
      )
      .run(keyStr, valueStr, expiresAt, now);
  }

  close(): void {
    this.db.close();
  }

  private cleanupExpired(): void {
    const now = Date.now();
    this.db.prepare('DELETE FROM cache WHERE expiresAt < ?').run(now);
  }
}
