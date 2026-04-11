import { describe, expect, test } from 'vitest';

import { ensureSpecGenerationEnv, SPEC_GENERATION_ENV_DEFAULTS } from './spec-generation-env';

describe('ensureSpecGenerationEnv', () => {
  test('fills required env defaults for OpenAPI generation without overriding explicit values', () => {
    const env: NodeJS.ProcessEnv = { BETTER_AUTH_URL: 'https://example.com' };

    ensureSpecGenerationEnv(env);

    expect(env.DATABASE_URL).toBe(SPEC_GENERATION_ENV_DEFAULTS.DATABASE_URL);
    expect(env.BETTER_AUTH_SECRET).toBe(SPEC_GENERATION_ENV_DEFAULTS.BETTER_AUTH_SECRET);
    expect(env.BETTER_AUTH_URL).toBe('https://example.com');
  });
});
