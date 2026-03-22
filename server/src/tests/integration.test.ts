import { integrationTest } from './fixtures.js';

integrationTest('should handle 404', async ({ app, expect }) => {
  const res = await app.request('/api/v1/unknown');
  expect(res.status).toBe(404);
});
