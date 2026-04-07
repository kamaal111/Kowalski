import { defineConfig } from 'vitest/config';
import path from 'path';

const databaseUrl =
  process.env.DATABASE_URL ??
  `postgresql://${process.env.KOWALSKI_DB_USER ?? 'kowalski_user'}:${process.env.KOWALSKI_DB_PASSWORD ?? 'kowalski_password'}@${process.env.KOWALSKI_DB_HOST ?? 'localhost'}:${process.env.KOWALSKI_DB_PORT ?? '5432'}/${process.env.KOWALSKI_DB_NAME ?? 'kowalski'}`;
const port = process.env.PORT ?? process.env.KOWALSKI_SERVER_PORT ?? '8080';
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`;
const betterAuthSecret = process.env.BETTER_AUTH_SECRET ?? 'test-secret-for-testing-only';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      DATABASE_URL: databaseUrl,
      MODE: 'TEST',
      BETTER_AUTH_SECRET: betterAuthSecret,
      BETTER_AUTH_URL: betterAuthUrl,
      PORT: port,
      DEBUG: 'true',
      BETTER_AUTH_SESSION_UPDATE_AGE_DAYS: '1',
      BETTER_AUTH_SESSION_EXPIRY_DAYS: '30',
      JWT_EXPIRY_DAYS: '7',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/'],
    },
  },
});
