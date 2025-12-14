import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@test-vars': path.resolve(__dirname, './src/tests/setup.ts'),
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./src/tests/setup.ts'],
    env: {
      DATABASE_URL: 'postgresql://kowalski_user:kowalski_password@localhost:5432/kowalski',
      MODE: 'TEST',
      BETTER_AUTH_SECRET: 'test-secret-for-testing-only',
      BETTER_AUTH_URL: 'http://localhost:8080',
      PORT: '8080',
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
