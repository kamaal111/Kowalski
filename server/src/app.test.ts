import { describe, expect, test } from 'vitest';

import { generateOpenAPISpecYaml } from '@/app';

describe('generateOpenAPISpecYaml', () => {
  test('returns the documented YAML spec without a running server', async () => {
    const spec = await generateOpenAPISpecYaml();

    expect(spec).toContain('openapi: 3.1.1');
    expect(spec).toContain('title: Kowalski API');
    expect(spec).toContain('/app-api/auth/session:');
  });
});
