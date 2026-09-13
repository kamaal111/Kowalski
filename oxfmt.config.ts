import kamaalOxfmtStyle from '@kamaal111/kamaal-quality-config/oxfmt';
import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...kamaalOxfmtStyle,
  ignorePatterns: [
    'dist',
    'pnpm-lock.yaml',
    '.env',
    'app',
    '**/*.swift',
    'postman',
    'server/drizzle',
    '**/.test-cache',
  ],
});
