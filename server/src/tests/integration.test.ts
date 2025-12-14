import { it, expect } from 'vitest';

import { app } from '@test-vars';

it('should handle 404', async () => {
  const res = await app.request('/api/v1/unknown');
  expect(res.status).toBe(404);
});
